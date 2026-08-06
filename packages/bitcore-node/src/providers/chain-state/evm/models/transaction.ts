import { Utils, Web3 } from '@bitpay-labs/crypto-wallet-core';
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
import { partition, uniqBy, valueOrDefault } from '../../../../utils';
import { ERC20Abi } from '../abi/erc20';
import { ERC721Abi } from '../abi/erc721';
import { InvoiceAbi } from '../abi/invoice';
import { MultisendAbi } from '../abi/multisend';
import { MultisigAbi } from '../abi/multisig';
import {
  getCanonicalErc20ParticipantAddresses,
  getEffectiveEvmEffects,
  isValidErc20EffectsForTransaction
} from '../erc20Effects';
import type { IEVMNetworkConfig } from '../../../../types/Config';
import type { StreamingFindOptions } from '../../../../types/Query';
import type { TransformOptions } from '../../../../types/TransformOptions';
import type { EVMTransactionJSON, Effect, IAbiDecodeResponse, IAbiDecodedData, IEVMBlock, IEVMCachedAddress, IEVMTransaction, IEVMTransactionInProcess, ParsedAbiParams } from '../types';
import type { Web3Types } from '@bitpay-labs/crypto-wallet-core';

interface EVMTransactionWriteOperation {
  updateOne: {
    filter: any;
    update: any;
    upsert: boolean;
    forceServerObjectId?: boolean;
  };
}

function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    this.collection.createIndex(
      { chain: 1, network: 1, 'erc20Effects.items.to': 1, blockTimeNormalized: 1 },
      {
        background: true,
        partialFilterExpression: { 'erc20Effects.items.to': { $exists: true } }
      }
    );
    this.collection.createIndex(
      { chain: 1, network: 1, 'erc20Effects.items.from': 1, blockTimeNormalized: 1 },
      {
        background: true,
        partialFilterExpression: { 'erc20Effects.items.from': { $exists: true } }
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
      for (const tx of params.txs) {
        await this.expireErc20BalanceCacheForTransaction({ chain: params.chain, network: params.network, tx });
      }
    }

    // Create events for mempool txs
    if (params.height < SpentHeightIndicators.minimum) {
      for (const op of txOps) {
        const filter = op.updateOne.filter;
        const tx = { ...op.updateOne.update.$set, ...filter } as IEVMTransactionInProcess;
        await EventStorage.signalTx(tx);
        await EventStorage.signalAddressCoin({
          address: tx.to,
          coin: { value: Number(tx.value), address: tx.to, chain: params.chain, network: params.network, mintTxid: tx.txid }
        });
      }
    }
  }

  getAllTouchedAddresses(tx: Partial<IEVMTransaction>): { tos: IEVMCachedAddress[]; froms: IEVMCachedAddress[] } {
    const { to, from } = tx;
    const effects = getEffectiveEvmEffects(tx, undefined, Array.isArray(tx.effects) ? tx.effects : []);
    const toBatch = new Set<string>();
    const fromBatch = new Set<string>();
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

  async expireBalanceCacheForTransaction(params: { chain: string; network: string; tx: Partial<IEVMTransaction> }) {
    const { chain, network, tx } = params;
    const { tos, froms } = this.getAllTouchedAddresses(tx);
    for (const payload of tos.concat(froms)) {
      const lowerAddress = payload.address.toLowerCase();
      const cacheKey = payload.tokenAddress
        ? `getBalanceForAddress-${chain}-${network}-${lowerAddress}-${payload.tokenAddress.toLowerCase()}`
        : `getBalanceForAddress-${chain}-${network}-${lowerAddress}`;
      await CacheStorage.expire(cacheKey);
    }
  }

  async expireErc20BalanceCacheForTransaction(params: { chain: string; network: string; tx: Partial<IEVMTransaction> }) {
    const { chain, network, tx } = params;
    const canonical = tx.erc20Effects;
    if (!isValidErc20EffectsForTransaction(tx, canonical)) {
      return;
    }
    const cacheKeys = new Set<string>();
    for (const item of canonical.items) {
      const tokenAddress = item.contractAddress.toLowerCase();
      for (const address of [item.from, item.to]) {
        cacheKeys.add(
          `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress}`
        );
      }
    }
    for (const cacheKey of cacheKeys) {
      await CacheStorage.expire(cacheKey);
    }
  }

  async expireBalanceCache(txOps: Array<any>) {
    for (const op of txOps) {
      const { chain, network } = op.updateOne.filter;
      await this.expireBalanceCacheForTransaction({
        chain,
        network,
        tx: op.updateOne.update.$set
      });
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
  }): Promise<EVMTransactionWriteOperation[]> {
    const { blockTimeNormalized, chain, height, network, parentChain, forkHeight } = params;
    const findStoredErc20Effects = async (txids: string[]) => new Map<string, any>(txids.length
      ? (await this.collection.find({ chain, network, txid: { $in: Array.from(new Set(txids)) }, erc20Effects: { $exists: true } })
        .project({ txid: 1, 'erc20Effects.version': 1 }).toArray()).map(tx => [tx.txid, tx])
      : []);
    const findWallets = async (addresses: string[]) => uniqBy((addresses.length
      ? await WalletAddressStorage.collection.find({ chain, network, address: { $in: Array.from(new Set(addresses)) } }).toArray()
      : []).map(w => w.wallet), wallet => wallet.toHexString());
    if (parentChain && forkHeight && height < forkHeight) {
      const parentTxs = await EVMTransactionStorage.collection
        .find({ blockHeight: height, chain: parentChain, network })
        .toArray();
      const hasPreparedMaterialization = params.txs.some(tx =>
        isValidErc20EffectsForTransaction(tx, tx.erc20Effects)
      );
      const toChildSnapshot = (parentTx: any) => {
        const snapshot = { ...parentTx };
        for (const key of ['_id', 'wallets', 'chain', 'network', 'txid', 'erc20Effects']) delete snapshot[key];
        return { ...snapshot, chain, network };
      };
      if (!hasPreparedMaterialization) {
        const findPreparedTx = (txid: string) => params.txs.find(tx =>
          typeof tx.txid === 'string' && tx.txid.toLowerCase() === txid.toLowerCase());
        const storedErc20Effects = await findStoredErc20Effects(parentTxs.flatMap(parentTx => {
          const preparedTx = findPreparedTx(parentTx.txid);
          return preparedTx ? [parentTx.txid, preparedTx.txid] : [parentTx.txid];
        }));
        return Promise.all(parentTxs.map(async parentTx => {
          const preparedTx = findPreparedTx(parentTx.txid);
          const variants = preparedTx ? [preparedTx.txid, parentTx.txid] : [parentTx.txid];
          const storedChild = variants.map(txid => storedErc20Effects.get(txid)).find(Boolean);
          if (!storedChild) {
            const parentSnapshot = { ...parentTx };
            delete parentSnapshot.erc20Effects;
            return { updateOne: { filter: { txid: parentTx.txid, chain, network },
              update: { $set: { ...parentSnapshot, wallets: new Array<ObjectID>() } },
              upsert: true, forceServerObjectId: true } };
          }
          const touched = preparedTx ? this.getAllTouchedAddresses(preparedTx) : { tos: [], froms: [] };
          const wallets = await findWallets([...touched.froms, ...touched.tos].map(({ address }) => address));
          const update: any = { $set: toChildSnapshot(parentTx) };
          if (wallets.length) update.$addToSet = { wallets: { $each: wallets } };
          return { updateOne: { filter: { _id: storedChild._id, txid: storedChild.txid, chain, network },
            update, upsert: false } };
        }));
      }

      const normalizeTxid = (txid: unknown, source: string) => {
        if (typeof txid !== 'string' || !txid.length) {
          throw new Error(`Invalid ${source} transaction id in pre-fork persistence`);
        }
        return txid.toLowerCase();
      };
      const preparedByTxid = new Map<string, IEVMTransactionInProcess>();
      for (const tx of params.txs) {
        if (!isValidErc20EffectsForTransaction(tx, tx.erc20Effects)) {
          throw new Error(`Missing valid ERC-20 materialization for pre-fork transaction ${tx.txid}`);
        }
        const normalizedTxid = normalizeTxid(tx.txid, 'prepared child');
        if (preparedByTxid.has(normalizedTxid)) {
          throw new Error(`Duplicate prepared child transaction ${tx.txid} in pre-fork persistence`);
        }
        preparedByTxid.set(normalizedTxid, tx);
      }
      if (parentTxs.length !== preparedByTxid.size) {
        throw new Error('Pre-fork parent and prepared child transaction counts do not match');
      }
      const seenParentTxids = new Set<string>();
      const targetTxsByTxid = new Map<string, IEVMTransactionInProcess>();
      for (const parentTx of parentTxs) {
        const normalizedTxid = normalizeTxid(parentTx.txid, 'parent');
        if (seenParentTxids.has(normalizedTxid)) {
          throw new Error(`Duplicate parent transaction ${parentTx.txid} in pre-fork persistence`);
        }
        if (!preparedByTxid.has(normalizedTxid)) {
          throw new Error(`No prepared child transaction matches pre-fork parent transaction ${parentTx.txid}`);
        }
        const preparedTx = preparedByTxid.get(normalizedTxid)!;
        if (!isValidErc20EffectsForTransaction(parentTx, preparedTx.erc20Effects)) {
          throw new Error(`Prepared ERC-20 materialization does not match pre-fork parent inclusion ${parentTx.txid}`);
        }
        targetTxsByTxid.set(parentTx.txid, preparedTx).set(preparedTx.txid, preparedTx);
        seenParentTxids.add(normalizedTxid);
      }
      const storedErc20Effects = await findStoredErc20Effects(Array.from(targetTxsByTxid.keys()));
      return Promise.all(parentTxs.map(async parentTx => {
        const preparedTx = preparedByTxid.get(normalizeTxid(parentTx.txid, 'parent'))!;
        const canonicalAddresses = getCanonicalErc20ParticipantAddresses(preparedTx);
        const wallets = await findWallets(canonicalAddresses.flatMap(address => [address, address.toLowerCase()]));
        const txidVariants = Array.from(new Set([parentTx.txid, preparedTx.txid]));
        const update: any = {
          $set: toChildSnapshot(parentTx),
          $setOnInsert: { txid: preparedTx.txid }
        };
        if (!txidVariants.some(txid => {
          const storedVersion = storedErc20Effects.get(txid)?.erc20Effects?.version;
          return typeof storedVersion === 'number' && storedVersion > preparedTx.erc20Effects!.version;
        })) {
          update.$set.erc20Effects = preparedTx.erc20Effects;
        }
        if (wallets.length) {
          update.$addToSet = { wallets: { $each: wallets } };
        } else {
          update.$setOnInsert.wallets = [];
        }
        return {
          updateOne: {
            filter: { txid: { $in: txidVariants }, chain, network },
            update,
            upsert: true,
            forceServerObjectId: true
          }
        };
      }));
    } else {
      const materializedByTxid = new Map(params.txs.filter(tx =>
        height >= SpentHeightIndicators.minimum && isValidErc20EffectsForTransaction(tx)
      ).map(tx => [tx.txid, tx]));
      const storedErc20Effects = height >= SpentHeightIndicators.minimum
        ? await findStoredErc20Effects(params.txs.map(tx => tx.txid))
        : new Map<string, any>();
      return Promise.all(
        params.txs.map(async (tx: IEVMTransactionInProcess) => {
          const { tos, froms } = this.getAllTouchedAddresses(tx);
          const hasValidCanonicalMaterialization = materializedByTxid.has(tx.txid);
          const touchedAddresses = [...froms, ...tos].map(({ address }) => address);
          const canonicalAddressVariants = hasValidCanonicalMaterialization ? getCanonicalErc20ParticipantAddresses(tx).map(address => address.toLowerCase()) : [];
          const walletLookupAddresses = Array.from(new Set(touchedAddresses.concat(canonicalAddressVariants)));

          const walletsAddys = await WalletAddressStorage.collection
            .find({ chain, network, address: { $in: walletLookupAddresses } })
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
          const update: any = {
            $set: {
              ...leanTx,
              blockTimeNormalized
            }
          };
          delete update.$set.wallets;
          const storedVersion = storedErc20Effects.get(tx.txid)?.erc20Effects?.version;
          if (!hasValidCanonicalMaterialization ||
            (typeof storedVersion === 'number' && storedVersion > tx.erc20Effects!.version)) {
            delete update.$set.erc20Effects;
          }
          if (hasValidCanonicalMaterialization || storedErc20Effects.has(tx.txid)) {
            if (wallets.length) {
              update.$addToSet = { wallets: { $each: wallets } };
            } else {
              update.$setOnInsert = { wallets: [] };
            }
          } else {
            update.$set.wallets = wallets;
          }
          return {
            updateOne: {
              filter: { txid: tx.txid, chain, network },
              update,
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
    const originalQuery = params.query;
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
    } catch {/* ignore error */}
    try {
      const erc721Data: IAbiDecodeResponse = getErc721Decoder().decodeMethod(input);
      if (erc721Data) {
        return {
          type: 'ERC721',
          ...erc721Data
        };
      }
    } catch {/* ignore error */}
    try {
      const invoiceData: IAbiDecodeResponse = getInvoiceDecoder().decodeMethod(input);
      if (invoiceData) {
        return {
          type: 'INVOICE',
          ...invoiceData
        };
      }
    } catch {/* ignore error */}
    try {
      const multisendData: IAbiDecodeResponse = getMultisendDecoder().decodeMethod(input);
      if (multisendData) {
        return {
          type: 'MUTLISEND',
          ...multisendData
        };
      }
    } catch {/* ignore error */}
    try {
      const multisigData: IAbiDecodeResponse = getMultisigDecoder().decodeMethod(input);
      if (multisigData) {
        return {
          type: 'MULTISIG',
          ...multisigData
        };
      }
    } catch {/* ignore error */}
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
    for (const param of params) {
      const { value } = param;
      parsed[param.name] = value;
    }
    return parsed;
  }

  /**
   * Adds effects details object to in process txs
   */
  addEffectsToTxs(txs: IEVMTransactionInProcess[]) {
    for (const tx of txs) {
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
        for (const call of tx.calls) {
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
        for (const internalTx of tx.internal) {
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

  /**
   * Creates an array of effects that are filtered for relevance to a given list of addresses
   * @param {IEVMTransactionInProcess} tx 
   * @param {Array<string>} addresses
   */
  getEffectiveEffects(tx: Partial<IEVMTransactionInProcess>): Effect[] {
    const legacyEffects = tx.effects?.length ? tx.effects : this.getEffects(tx as IEVMTransactionInProcess);
    let config: IEVMNetworkConfig | undefined;
    if (tx.chain && tx.network) {
      config = Config.chainConfig({ chain: tx.chain, network: tx.network }) as IEVMNetworkConfig;
    }
    return getEffectiveEvmEffects(tx, config, legacyEffects);
  }

  getEffectsForAddresses(tx: IEVMTransactionInProcess, addresses: Array<string>): Effect[] {
    const effects = this.getEffectiveEffects(tx);
    const addySet = new Set(addresses.map(a => a.toLowerCase()));
    return effects.filter(effect => addySet.has(effect.to.toLowerCase()) || addySet.has(effect.from.toLowerCase()));
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
    };
    return effect;
  }
  /**
   * Receives any type of TX and returns a lean version without unused properties
   * @param tx - transaction to leanify
   */
  toLeanTransaction(tx: IEVMTransactionInProcess | IEVMTransaction): IEVMTransaction {
    const removableProperties = ['data', 'internal', 'calls', 'abiType'];
    for (const prop of removableProperties) {
      if (tx[prop]) {
        delete tx[prop];
      }
    }
    return tx;
  }

  convertRawTx(chain: string, network: string, tx: Partial<Web3Types.TransactionInfo>, block?: IEVMBlock): IEVMTransactionInProcess {
    if (!block) {
      const txid = tx.hash as string || '';
      const to = tx.to ? Web3.utils.toChecksumAddress(tx.to) : '';
      const from = tx.from ? Web3.utils.toChecksumAddress(tx.from) : '';
      const value = BigInt(tx.value!);
      const gas = BigInt(tx.gas || -1); // -1 indicates unknown
      const gasPrice = BigInt(tx.gasPrice || -1);
      const fee = gas < 0n || gasPrice < 0n ? -1n : gas * gasPrice;
      const abiType = this.abiDecode(tx.input as string);
      const nonce = BigInt(tx.nonce || 0);
      const convertedTx: IEVMTransactionInProcess = {
        chain,
        network,
        blockHeight: Number(valueOrDefault(tx.blockNumber, -1)),
        blockHash: valueOrDefault(tx.blockHash as string, undefined),
        data: Buffer.from(tx.input || '0x'),
        txid,
        blockTime: new Date(),
        blockTimeNormalized: new Date(),
        fee: Number(fee),
        transactionIndex: Number(tx.transactionIndex || 0),
        value: Number(value),
        wallets: [],
        to,
        from,
        gasLimit: Number(gas),
        gasPrice: Number(gasPrice),
        nonce: Number(nonce),
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
    return JSON.stringify(transaction, Utils.BI.JSONStringifyBigIntReplacer);
  }
}
export const EVMTransactionStorage = new EVMTransactionModel();
