import { ObjectID } from 'bson';
import { LoggifyClass } from '../../../../decorators/Loggify';
import logger from '../../../../logger';
import { MongoBound } from '../../../../models/base';
import { BaseTransaction } from '../../../../models/baseTransaction';
import { CacheStorage } from '../../../../models/cache';
import { EventStorage } from '../../../../models/events';
import { WalletAddressStorage } from '../../../../models/walletAddress';
import { Config } from '../../../../services/config';
import { Storage, StorageService } from '../../../../services/storage';
import { SpentHeightIndicators } from '../../../../types/Coin';
import { StreamingFindOptions } from '../../../../types/Query';
import { TransformOptions } from '../../../../types/TransformOptions';
import { partition, uniqBy, valueOrDefault } from '../../../../utils';
import { ERC20Abi } from '../abi/erc20';
import { ERC721Abi } from '../abi/erc721';
import { InvoiceAbi } from '../abi/invoice';
import { MultisendAbi } from '../abi/multisend';
import { MultisigAbi } from '../abi/multisig';

import Web3 from 'web3';
import { IEVMNetworkConfig } from '../../../../types/Config';
import { Effect, ErigonTransaction, EVMTransactionJSON, GethTransaction, IAbiDecodedData, IAbiDecodeResponse, IEVMBlock, IEVMCachedAddress, IEVMTransaction, IEVMTransactionInProcess, ParsedAbiParams } from '../types';

function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  return require(module);
}

const Erc20Decoder = requireUncached('abi-decoder');
Erc20Decoder.addABI(ERC20Abi);
function getErc20Decoder() {
  return Erc20Decoder;
}

const Erc721Decoder = requireUncached('abi-decoder');
Erc721Decoder.addABI(ERC721Abi);
function getErc721Decoder() {
  return Erc721Decoder;
}

const InvoiceDecoder = requireUncached('abi-decoder');
InvoiceDecoder.addABI(InvoiceAbi);
function getInvoiceDecoder() {
  return InvoiceDecoder;
}

const MultisigDecoder = requireUncached('abi-decoder');
MultisigDecoder.addABI(MultisigAbi);
function getMultisigDecoder() {
  return MultisigDecoder;
}

const MultisendDecoder = requireUncached('abi-decoder');
MultisendDecoder.addABI(MultisendAbi);
function getMultisendDecoder() {
  return MultisendDecoder;
}

@LoggifyClass
export class EVMTransactionModel extends BaseTransaction<IEVMTransaction> {
  constructor(storage: StorageService = Storage) {
    super(storage);
  }

  async onConnect() {
    super.onConnect();
    this.collection.createIndex({ chain: 1, network: 1, to: 1 }, { background: true, sparse: true });
    this.collection.createIndex({ chain: 1, network: 1, from: 1 }, { background: true, sparse: true });
    this.collection.createIndex({ chain: 1, network: 1, from: 1, nonce: 1 }, { background: true, sparse: true });
    this.collection.createIndex(
      { chain: 1, network: 1, 'abiType.params.0.value': 1, blockTimeNormalized: 1 },
      {
        background: true,
        partialFilterExpression: { 'abiType.type': 'ERC20', 'abiType.name': 'transfer' }
      }
    );
    this.collection.createIndex(
      { chain: 1, network: 1, 'calls.abiType.params.value': 1, blockTimeNormalized: 1 },
      {
        background: true,
        partialFilterExpression: { 'calls.abiType.type': 'ERC20', 'calls.abiType.params.type': 'address' }
      }
    );
    this.collection.createIndex(
      { chain: 1, network: 1, 'internal.action.to': 1 },
      {
        background: true,
        sparse: true
      }
    );
    this.collection.createIndex(
      { chain: 1, network: 1, 'calls.to': 1 },
      {
        background: true,
        sparse: true
      }
    );
    this.collection.createIndex(
      { chain: 1, network: 1, 'effects.to': 1, blockTimeNormalized: 1 },
      {
        background: true,
        partialFilterExpression: { 'effects.to': { $exists: true } }
      }
    );
    this.collection.createIndex(
      { chain: 1, network: 1, 'effects.from': 1, blockTimeNormalized: 1 },
      {
        background: true,
        partialFilterExpression: { 'effects.from': { $exists: true } }
      }
    );
  }

  async batchImport(params: {
    txs: Array<IEVMTransactionInProcess>;
    height: number;
    mempoolTime?: Date;
    blockTime?: Date;
    blockHash?: string;
    blockTimeNormalized?: Date;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
    initialSyncComplete: boolean;
  }) {
    const operations = [] as Array<Promise<any>>;
    operations.push(this.pruneMempool({ ...params }));
    const txOps = await this.addTransactions({ ...params });
    logger.debug('Writing Transactions: %o', txOps.length);
    operations.push(
      ...partition(txOps, txOps.length / Config.get().maxPoolSize).map(txBatch =>
        this.collection.bulkWrite(
          txBatch.map(op => this.toMempoolSafeUpsert(op, params.height)),
          { ordered: false }
        )
      )
    );
    await Promise.all(operations);

    if (params.initialSyncComplete) {
      await this.expireBalanceCache(txOps);
    }

    // Create events for mempool txs
    if (params.height < SpentHeightIndicators.minimum) {
      for (let op of txOps) {
        const filter = op.updateOne.filter;
        const tx = { ...op.updateOne.update.$set, ...filter } as IEVMTransactionInProcess;
        await EventStorage.signalTx(tx);
        await EventStorage.signalAddressCoin({
          address: tx.to,
          coin: { value: tx.value, address: tx.to, chain: params.chain, network: params.network, mintTxid: tx.txid }
        });
      }
    }
  }

  getAllTouchedAddresses(tx: Partial<IEVMTransaction>): { tos: IEVMCachedAddress[], froms: IEVMCachedAddress[] } {
    const { to, from, effects } = tx;
    let toBatch = new Set<string>();
    let fromBatch = new Set<string>();
    const addToBatch = (batch: Set<string>, obj: IEVMCachedAddress) => {
      // Adds string representation to batch to guard uniqueness since {} != {} but '{}' == '{}'
      batch.add(JSON.stringify(obj));
    };
    addToBatch(toBatch, { address: to as string });
    addToBatch(fromBatch, { address: from as string });
    if (effects && effects.length) {
      for (const effect of effects) {
        // Handle internal value transfers
        if (!effect.contractAddress) {
          addToBatch(toBatch, { address: effect.to });
          addToBatch(fromBatch, { address: effect.from });
        } else if (effect.type == 'ERC20:transfer') {
          // Handle ERC20s
          addToBatch(toBatch, { address: effect.to, tokenAddress: effect.contractAddress });
          addToBatch(fromBatch, { address: effect.from, tokenAddress: effect.contractAddress });
        }
      }
    }

    // Convert Set made up of unique strings back to object representations
    const tos: IEVMCachedAddress[] = Array.from(toBatch).map(strObj => JSON.parse(strObj));
    const froms: IEVMCachedAddress[] = Array.from(fromBatch).map(strObj => JSON.parse(strObj));

    return { tos, froms };
  }

  async expireBalanceCache(txOps: Array<any>) {
    for (const op of txOps) {
      const { chain, network } = op.updateOne.filter;

      const { tos, froms } = this.getAllTouchedAddresses(op.updateOne.update.$set);
      const uniqueBatch = tos.concat(froms);
      for (const payload of uniqueBatch) {
        const lowerAddress = payload.address.toLowerCase();
        const cacheKey = payload.tokenAddress
          ? `getBalanceForAddress-${chain}-${network}-${lowerAddress}-${payload.tokenAddress.toLowerCase()}`
          : `getBalanceForAddress-${chain}-${network}-${lowerAddress}`;
        await CacheStorage.expire(cacheKey);
      }
    }
  }

  async addTransactions(params: {
    txs: Array<IEVMTransactionInProcess>;
    height: number;
    blockTime?: Date;
    blockHash?: string;
    blockTimeNormalized?: Date;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    mempoolTime?: Date;
  }) {
    let { blockTimeNormalized, chain, height, network, parentChain, forkHeight } = params;
    if (parentChain && forkHeight && height < forkHeight) {
      const parentTxs = await EVMTransactionStorage.collection
        .find({ blockHeight: height, chain: parentChain, network })
        .toArray();
      return parentTxs.map(parentTx => {
        return {
          updateOne: {
            filter: { txid: parentTx.txid, chain, network },
            update: {
              $set: {
                ...parentTx,
                wallets: new Array<ObjectID>()
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        };
      });
    } else {
      return Promise.all(
        // Get all "to" and "from" addresses so we can add the any corresponding wallets
        params.txs.map(async (tx: IEVMTransactionInProcess) => {
          const { tos, froms } = this.getAllTouchedAddresses(tx);
          const toAddresses = tos.map(a => a.address);
          const fromAddresses = froms.map(a => a.address);

          const walletsAddys = await WalletAddressStorage.collection
            .find({ chain, network, address: { $in: [...fromAddresses, ...toAddresses] } })
            .toArray();
          const wallets = uniqBy(
            walletsAddys.map(w => w.wallet),
            w => w.toHexString()
          );

          // If config value is set then only store needed tx properties
          let leanTx: IEVMTransaction | IEVMTransactionInProcess = tx;
          if ((Config.chainConfig({ chain, network }) as IEVMNetworkConfig).leanTransactionStorage) {
            leanTx = EVMTransactionStorage.toLeanTransaction(tx);
          }
          return {
            updateOne: {
              filter: { txid: tx.txid, chain, network },
              update: {
                $set: {
                  ...leanTx,
                  blockTimeNormalized,
                  wallets
                }
              },
              upsert: true,
              forceServerObjectId: true
            }
          };
        })
      );
    }
  }

  async pruneMempool(params: {
    txs: Array<IEVMTransactionInProcess>;
    height: number;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
    initialSyncComplete: boolean;
  }) {
    const { chain, network, initialSyncComplete, txs } = params;
    if (!initialSyncComplete) {
      return;
    }
    for (const tx of txs) {
      await this.collection.update(
        {
          chain,
          network,
          from: tx.from,
          nonce: tx.nonce,
          txid: { $ne: tx.txid },
          blockHeight: SpentHeightIndicators.pending
        },
        { $set: { blockHeight: SpentHeightIndicators.conflicting, replacedByTxid: tx.txid } },
        { w: 0, j: false, multi: true }
      );
    }
    return;
  }

  getTransactions(params: { query: any; options: StreamingFindOptions<IEVMTransaction> }) {
    let originalQuery = params.query;
    const { query, options } = Storage.getFindOptions(this, params.options);
    const finalQuery = Object.assign({}, originalQuery, query);
    return this.collection.find(finalQuery, options).addCursorFlag('noCursorTimeout', true);
  }

  abiDecode(input: string) {
    try {
      const erc20Data: IAbiDecodeResponse = getErc20Decoder().decodeMethod(input);
      if (erc20Data) {
        return {
          type: 'ERC20',
          ...erc20Data
        };
      }
    } catch (e) { }
    try {
      const erc721Data: IAbiDecodeResponse = getErc721Decoder().decodeMethod(input);
      if (erc721Data) {
        return {
          type: 'ERC721',
          ...erc721Data
        };
      }
    } catch (e) { }
    try {
      const invoiceData: IAbiDecodeResponse = getInvoiceDecoder().decodeMethod(input);
      if (invoiceData) {
        return {
          type: 'INVOICE',
          ...invoiceData
        };
      }
    } catch (e) { }
    try {
      const multisendData: IAbiDecodeResponse = getMultisendDecoder().decodeMethod(input);
      if (multisendData) {
        return {
          type: 'MUTLISEND',
          ...multisendData
        };
      }
    } catch (e) { }
    try {
      const multisigData: IAbiDecodeResponse = getMultisigDecoder().decodeMethod(input);
      if (multisigData) {
        return {
          type: 'MULTISIG',
          ...multisigData
        };
      }
    } catch (e) { }
    return undefined;
  }

  /**
   * Creates an object with param names as keys instead of an array of objects
   * @param abi 
   * @returns object of abi param values that can be accessed with the name as a key
   */
  parseAbiParams(abi: IAbiDecodedData): ParsedAbiParams {
    const params = abi.params;
    const parsed = {} as ParsedAbiParams;
    for (let param of params) {
      const { value } = param;
      parsed[param.name] = value;
    }
    return parsed;
  }

  /**
   * Adds effects details object to in process txs
   */
  addEffectsToTxs(txs: IEVMTransactionInProcess[]) {
    for (let tx of txs) {
      tx.effects = this.getEffects(tx);
    }
  }

  /**
   * Creates an array of all effects for a given tx
   * @param tx A tx object that contains extra data that we don't want to store long term
   * @returns An array of all effects for the transaction
   */
  getEffects(tx: IEVMTransactionInProcess): Effect[] {
    const effects = [] as Effect[];
    try {
      if (tx.calls?.length) { // Geth trace calls[]
        for (let call of tx.calls) {
          if (call.value && BigInt(call.value) > 0) {
            // Handle native asset transfer
            const effect = this._getEffectForNativeTransfer(BigInt(call.value).toString(), call.to, call.from, call.depth);
            effects.push(effect);
          }
          if (call.abiType) { // If there was a known ABI (ERC20, Invoice) transfer within the tx execution
            // Handle Abi related effects
            let effect: Effect | undefined;
            if (call.type === 'DELEGATECALL') { // Delegate calls are proxy calls within a smart contract
              // find parent call that's one level up. E.g. if depth = '0_1_2', then find '0_1'
              const parent = tx.calls.find(c => c.depth === call.depth.split('_').slice(0, -1).join('_')) || { to: tx.to, from: tx.from, input: null }; // Fallback to tx.to and tx.from if no parent found
              if (parent?.to === call.from && parent?.input === call.input) {
                // If parent is the same as the current call, then it's just a proxy call
                continue;
              }
              effect = this._getEffectForAbiType(call.abiType, parent.to, parent.from, call.depth);
            } else {
              effect = this._getEffectForAbiType(call.abiType, call.to, call.from, call.depth);
            }
            if (effect) {
              effects.push(effect);
            }
          }
        }
      } else if (tx.internal?.length) { // LEGACY: Used for converting old OpenEthereum/Parity db entries with internal[]
        for (let internalTx of tx.internal) {
          if (internalTx.action.value && BigInt(internalTx.action.value) > 0) {
            // Handle native asset transfer
            const effect = this._getEffectForNativeTransfer(BigInt(internalTx.action.value).toString(), internalTx.action.to, internalTx.action.from || tx.from, internalTx.traceAddress.join('_'));
            effects.push(effect);
          }
          if (internalTx.abiType) {
            // Handle Abi related effects
            const effect = this._getEffectForAbiType(internalTx.abiType, internalTx.action.to, internalTx.action.from || tx.from, internalTx.traceAddress.join('_'));
            if (effect) {
              effects.push(effect);
            }
          }
        }
      } else if (tx.abiType) { // We recognized upstream that this is a known ABI tx
        // Handle Abi related effects
        const effect = this._getEffectForAbiType(tx.abiType, tx.to, tx.from, '');
        if (effect) {
          effects.push(effect);
        }
      } 
    } catch (err) {
      logger.error('Error Getting Effects For TxId: %o ::%o', tx.txid, err);
    }
    return effects;
  }

  _getEffectForAbiType(abi: IAbiDecodedData, to: string, from: string, callStack: string): Effect | undefined {
    // Check that the params are valid before parsing
    if (!to || !from) return;
    if (`${abi.type}:${abi.name}` == 'ERC20:transfer') {
      const params = this.parseAbiParams(abi);
      const { _to, _value } = params;
      // Check that the params are valid before parsing
      if (!_to || !_value) return;
      return {
        type: 'ERC20:transfer',
        to: Web3.utils.toChecksumAddress(_to),
        from: Web3.utils.toChecksumAddress(from),
        amount: Web3.utils.fromWei(_value, 'wei'),
        contractAddress: Web3.utils.toChecksumAddress(to),
        callStack
      };
    } else if (`${abi.type}:${abi.name}` == 'ERC20:transferFrom') {
      const params = this.parseAbiParams(abi);
      const { _to, _from, _value } = params;
      // Check that the params are valid before parsing
      if (!_to || !_from || !_value) return;
      return {
        type: 'ERC20:transfer',
        to: Web3.utils.toChecksumAddress(_to),
        from: Web3.utils.toChecksumAddress(_from),
        amount: Web3.utils.fromWei(_value, 'wei'),
        contractAddress: Web3.utils.toChecksumAddress(to),
        callStack
      };
    } else if (`${abi.type}:${abi.name}` == 'MULTISIG:submitTransaction') {
      const params = this.parseAbiParams(abi);
      const { destination, value } = params;
      // Check that the params are valid before parsing
      if (!destination || !value) return;
      return {
        type: 'MULTISIG:submitTransaction',
        to: Web3.utils.toChecksumAddress(destination),
        from: Web3.utils.toChecksumAddress(from),
        amount: Web3.utils.fromWei(value, 'wei'),
        contractAddress: Web3.utils.toChecksumAddress(to),
        callStack
      };
    } else if (`${abi.type}:${abi.name}` == 'MULTISIG:confirmTransaction') {
      return {
        type: 'MULTISIG:confirmTransaction',
        to: '0x0',
        from: Web3.utils.toChecksumAddress(from),
        amount: '0',
        contractAddress: Web3.utils.toChecksumAddress(to),
        callStack
      };
    }
    return;
  }

  _getEffectForNativeTransfer(value: string, to: string, from: string, callStack: string): Effect {
    const effect = {
      to: Web3.utils.toChecksumAddress(to),
      from: Web3.utils.toChecksumAddress(from),
      amount: Web3.utils.fromWei(value, 'wei'),
      callStack
    }
    return effect;
  }
  /**
   * Receives any type of TX and returns a lean version without unused properties
   * @param tx - transaction to leanify
   */
  toLeanTransaction(tx: IEVMTransactionInProcess | IEVMTransaction): IEVMTransaction {
    const removableProperties = ['data', 'internal', 'calls', 'abiType'];
    for (let prop of removableProperties) {
      if (tx[prop]) {
        delete tx[prop];
      }
    }
    return tx;
  }

  convertRawTx(chain: string, network: string, tx: Partial<ErigonTransaction | GethTransaction>, block?: IEVMBlock): IEVMTransactionInProcess {
    if (!block) {
      const txid = tx.hash || '';
      const to = tx.to || '';
      const from = tx.from || '';
      const value = Number(tx.value);
      const fee = Number(tx.gas) * Number(tx.gasPrice);
      const abiType = this.abiDecode(tx.input!);
      const nonce = tx.nonce || 0;
      const convertedTx: IEVMTransactionInProcess = {
        chain,
        network,
        blockHeight: valueOrDefault(tx.blockNumber, -1),
        blockHash: valueOrDefault(tx.blockHash, undefined),
        data: Buffer.from(tx.input || '0x'),
        txid,
        blockTime: new Date(),
        blockTimeNormalized: new Date(),
        fee,
        transactionIndex: tx.transactionIndex || 0,
        value,
        wallets: [],
        to,
        from,
        gasLimit: Number(tx.gas),
        gasPrice: Number(tx.gasPrice),
        nonce,
        internal: [],
        calls: []
      };
      if (abiType) {
        convertedTx.abiType = abiType;
      }
      return convertedTx;
    } else {
      const { hash: blockHash, time: blockTime, timeNormalized: blockTimeNormalized, height } = block;
      const noBlockTx = this.convertRawTx(chain, network, tx);
      return {
        ...noBlockTx,
        blockHeight: height,
        blockHash,
        blockTime,
        blockTimeNormalized
      };
    }
  }

  // Correct tx.data.toString() => 0xa9059cbb00000000000000000000000001503dfc5ad81bf630d83697e98601871bb211b60000000000000000000000000000000000000000000000000000000000002710
  // Incorrect: tx.data.toString('hex') => 307861393035396362623030303030303030303030303030303030303030303030303031353033646663356164383162663633306438333639376539383630313837316262323131623630303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303032373130

  _apiTransform(
    tx: IEVMTransactionInProcess | Partial<MongoBound<IEVMTransactionInProcess>>,
    options?: TransformOptions
  ): EVMTransactionJSON | string {

    let transaction: EVMTransactionJSON = {
      txid: tx.txid || '',
      network: tx.network || '',
      chain: tx.chain || '',
      blockHeight: valueOrDefault(tx.blockHeight, -1),
      blockHash: tx.blockHash || '',
      blockTime: tx.blockTime ? tx.blockTime.toISOString() : '',
      blockTimeNormalized: tx.blockTimeNormalized ? tx.blockTimeNormalized.toISOString() : '',
      fee: valueOrDefault(tx.fee, -1),
      value: valueOrDefault(tx.value, -1),
      gasLimit: valueOrDefault(tx.gasLimit, -1),
      gasPrice: valueOrDefault(tx.gasPrice, -1),
      nonce: valueOrDefault(tx.nonce, 0),
      to: tx.to || '',
      from: tx.from || '',
      effects: tx.effects || []
    };

    // Add non-lean properties if we aren't excluding them
    const config = Config.chainConfig({ chain: tx.chain as string, network: tx.network as string }) as IEVMNetworkConfig;
    if (config && !config.leanTransactionStorage) {
      const dataStr = tx.data ? tx.data.toString() : '';
      const decodedData = this.abiDecode(dataStr);
      const nonLeanProperties = {
        data: dataStr,
        abiType: tx.abiType || valueOrDefault(decodedData, undefined),
        internal: tx.internal
          ? tx.internal.map(t => ({ ...t, decodedData: this.abiDecode(t?.action?.input || '0x') }))
          : [],
        calls: tx.calls ? tx.calls.map(t => ({ ...t, decodedData: this.abiDecode(t.input || '0x') })) : []
      };
      transaction = Object.assign(transaction, nonLeanProperties);
    }

    if (options && options.object) {
      return transaction;
    }
    return JSON.stringify(transaction);
  }
}
export let EVMTransactionStorage = new EVMTransactionModel();
