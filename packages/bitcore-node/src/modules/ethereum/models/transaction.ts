import { ObjectID } from 'bson';
import * as _ from 'lodash';
import { LoggifyClass } from '../../../decorators/Loggify';
import logger from '../../../logger';
import { MongoBound } from '../../../models/base';
import { BaseTransaction } from '../../../models/baseTransaction';
import { CacheStorage } from '../../../models/cache';
import { EventStorage } from '../../../models/events';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { Config } from '../../../services/config';
import { Storage, StorageService } from '../../../services/storage';
import { SpentHeightIndicators } from '../../../types/Coin';
import { StreamingFindOptions } from '../../../types/Query';
import { TransformOptions } from '../../../types/TransformOptions';
import { valueOrDefault } from '../../../utils/check';
import { partition } from '../../../utils/partition';
import { ERC20Abi } from '../abi/erc20';
import { ERC721Abi } from '../abi/erc721';
import { InvoiceAbi } from '../abi/invoice';
import { MultisigAbi } from '../abi/multisig';

import { EthTransactionJSON, IEthTransaction } from '../types';

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

@LoggifyClass
export class EthTransactionModel extends BaseTransaction<IEthTransaction> {
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
        partialFilterExpression: { chain: 'ETH', 'abiType.type': 'ERC20', 'abiType.name': 'transfer' }
      }
    );
    this.collection.createIndex(
      { chain: 1, network: 1, 'internal.action.to': 1 },
      {
        background: true,
        sparse: true
      }
    );
  }

  async batchImport(params: {
    txs: Array<IEthTransaction>;
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
    logger.debug('Writing Transactions', txOps.length);
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
        const tx = { ...op.updateOne.update.$set, ...filter } as IEthTransaction;
        await EventStorage.signalTx(tx);
        await EventStorage.signalAddressCoin({
          address: tx.to,
          coin: { value: tx.value, address: tx.to, chain: params.chain, network: params.network, mintTxid: tx.txid }
        });
      }
    }
  }

  async expireBalanceCache(txOps: Array<any>) {
    for (const op of txOps) {
      let batch = new Array<{ multisigContractAdress?: string; tokenAddress?: string; address: string }>();
      const { chain, network } = op.updateOne.filter;
      const { from, to, abiType, internal } = op.updateOne.update.$set;
      batch = batch.concat([{ address: from }, { address: to }]);
      if (abiType && abiType.type === 'ERC20' && abiType.params.length) {
        batch.push({ address: from, tokenAddress: to });
        batch.push({ address: abiType.params[0].value, tokenAddress: to });
      }

      if (internal && internal.length > 0) {
        internal.forEach(i => {
          if (i.action.to) batch.push({ address: i.action.to });
          if (i.action.from) batch.push({ address: i.action.from });
        });
      }

      for (const payload of batch) {
        const lowerAddress = payload.address.toLowerCase();
        const cacheKey = payload.tokenAddress
          ? `getBalanceForAddress-${chain}-${network}-${lowerAddress}-${to.toLowerCase()}`
          : `getBalanceForAddress-${chain}-${network}-${lowerAddress}`;
        await CacheStorage.expire(cacheKey);
      }
    }
  }

  async addTransactions(params: {
    txs: Array<IEthTransaction>;
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
      const parentTxs = await EthTransactionStorage.collection
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
        params.txs.map(async (tx: IEthTransaction) => {
          const { to, txid, from } = tx;
          const sentWallets = await WalletAddressStorage.collection.find({ chain, network, address: from }).toArray();
          const receivedWallets = await WalletAddressStorage.collection.find({ chain, network, address: to }).toArray();
          const wallets = _.uniqBy(
            sentWallets.concat(receivedWallets).map(w => w.wallet),
            w => w.toHexString()
          );

          return {
            updateOne: {
              filter: { txid, chain, network },
              update: {
                $set: {
                  ...tx,
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
    txs: Array<IEthTransaction>;
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
        { $set: { blockHeight: SpentHeightIndicators.conflicting } },
        { w: 0, j: false, multi: true }
      );
    }
    return;
  }

  getTransactions(params: { query: any; options: StreamingFindOptions<IEthTransaction> }) {
    let originalQuery = params.query;
    const { query, options } = Storage.getFindOptions(this, params.options);
    const finalQuery = Object.assign({}, originalQuery, query);
    return this.collection.find(finalQuery, options).addCursorFlag('noCursorTimeout', true);
  }

  abiDecode(input: string) {
    try {
      const erc20Data = getErc20Decoder().decodeMethod(input);
      if (erc20Data) {
        return {
          type: 'ERC20',
          ...erc20Data
        };
      }
    } catch (e) {}
    try {
      const erc721Data = getErc721Decoder().decodeMethod(input);
      if (erc721Data) {
        return {
          type: 'ERC721',
          ...erc721Data
        };
      }
    } catch (e) {}
    try {
      const invoiceData = getInvoiceDecoder().decodeMethod(input);
      if (invoiceData) {
        return {
          type: 'INVOICE',
          ...invoiceData
        };
      }
    } catch (e) {}
    try {
      const multisigData = getMultisigDecoder().decodeMethod(input);
      if (multisigData) {
        return {
          type: 'MULTISIG',
          ...multisigData
        };
      }
    } catch (e) {}
    return undefined;
  }

  _apiTransform(
    tx: IEthTransaction | Partial<MongoBound<IEthTransaction>>,
    options?: TransformOptions
  ): EthTransactionJSON | string {
    const dataStr = `0x${tx.data!.toString('hex')}`;
    const decodedData = this.abiDecode(dataStr);

    const transaction: EthTransactionJSON = {
      txid: tx.txid || '',
      network: tx.network || '',
      chain: tx.chain || '',
      blockHeight: valueOrDefault(tx.blockHeight, -1),
      blockHash: tx.blockHash || '',
      blockTime: tx.blockTime ? tx.blockTime.toISOString() : '',
      blockTimeNormalized: tx.blockTimeNormalized ? tx.blockTimeNormalized.toISOString() : '',
      fee: valueOrDefault(tx.fee, -1),
      value: valueOrDefault(tx.value, -1),
      data: dataStr,
      gasLimit: valueOrDefault(tx.gasLimit, -1),
      gasPrice: valueOrDefault(tx.gasPrice, -1),
      nonce: valueOrDefault(tx.nonce, 0),
      to: tx.to || '',
      from: tx.from || '',
      abiType: tx.abiType,
      internal: tx.internal
        ? tx.internal.map(t => ({ ...t, decodedData: this.abiDecode(t.action.input || '0x') }))
        : [],
      decodedData: valueOrDefault(decodedData, undefined),
      receipt: valueOrDefault(tx.receipt, undefined)
    };
    if (options && options.object) {
      return transaction;
    }
    return JSON.stringify(transaction);
  }
}
export let EthTransactionStorage = new EthTransactionModel();
