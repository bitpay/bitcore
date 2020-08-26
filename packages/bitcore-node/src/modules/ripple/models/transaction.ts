import { ObjectID } from 'bson';
import * as _ from 'lodash';
import { LoggifyClass } from '../../../decorators/Loggify';
import logger from '../../../logger';
import { MongoBound } from '../../../models/base';
import { BaseTransaction } from '../../../models/baseTransaction';
import { CacheStorage } from '../../../models/cache';
import { CoinStorage } from '../../../models/coin';
import { EventStorage } from '../../../models/events';
import { Config } from '../../../services/config';
import { Storage, StorageService } from '../../../services/storage';
import { SpentHeightIndicators } from '../../../types/Coin';
import { StreamingFindOptions } from '../../../types/Query';
import { TransformOptions } from '../../../types/TransformOptions';
import { valueOrDefault } from '../../../utils/check';
import { partition } from '../../../utils/partition';
import { IXrpCoin, IXrpTransaction, XrpTransactionJSON } from '../types';

@LoggifyClass
export class XrpTransactionModel extends BaseTransaction<IXrpTransaction> {
  constructor(storage: StorageService = Storage) {
    super(storage);
  }

  onConnect() {
    super.onConnect();
    this.collection.createIndex({ chain: 1, network: 1, from: 1, nonce: 1 }, { background: true, sparse: true });
  }

  async batchImport(params: {
    txs: Array<IXrpTransaction>;
    coins: Array<IXrpCoin>;
    height?: number;
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
    const txOps = await this.addTransactions({ ...params });
    const coinOps = (await this.addCoins({ ...params })) as Array<any>;
    const batchSize = Config.get().maxPoolSize;
    logger.debug('Writing Transactions', txOps.length);
    await Promise.all(
      partition(txOps, txOps.length / batchSize).map(txBatch =>
        this.collection.bulkWrite(
          txBatch.map(op => this.toMempoolSafeUpsert(op, SpentHeightIndicators.minimum)),
          {
            ordered: false
          }
        )
      )
    );

    await Promise.all(
      partition(coinOps, coinOps.length / batchSize).map(coinBatch =>
        CoinStorage.collection.bulkWrite(
          coinBatch.map(op => this.toMempoolSafeUpsert(op, SpentHeightIndicators.minimum)),
          { ordered: false }
        )
      )
    );

    if (params.initialSyncComplete) {
      await this.expireBalanceCache(coinOps);
    }

    // Create events for mempool txs
    if (params.height != undefined && params.height < SpentHeightIndicators.minimum) {
      for (let op of txOps) {
        const filter = op.updateOne.filter;
        const tx = { ...op.updateOne.update.$set, ...filter } as IXrpTransaction;
        await EventStorage.signalTx(tx);
      }

      for (const coinOp of coinOps) {
        const coin = { ...coinOp.updateOne.filter, ...coinOp.updateOne.update.$set } as IXrpCoin;
        await EventStorage.signalAddressCoin({
          address: coin.address,
          coin: {
            value: coin.value,
            address: coin.address,
            chain: params.chain,
            network: params.network,
            mintTxid: coin.mintTxid
          }
        });
      }
    }
  }

  async expireBalanceCache(coinOps: Array<any>) {
    let batch = new Array<{ address: string; chain: string; network: string }>();
    for (const coinOp of coinOps) {
      const coin = { ...coinOp.updateOne.filter, ...coinOp.updateOne.update.$set } as IXrpCoin;
      const { address, chain, network } = coin;
      batch.push({ address, chain, network });
    }

    for (const payload of batch) {
      const { address, chain, network } = payload;
      const lowerAddress = address.toLowerCase();
      const cacheKey = `getBalanceForAddress-${chain}-${network}-${lowerAddress}`;
      await CacheStorage.expire(cacheKey);
    }
  }

  async addTransactions(params: {
    txs: Array<IXrpTransaction>;
    height?: number;
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
    if (parentChain && forkHeight && height != undefined && height < forkHeight) {
      const parentTxs = await XrpTransactionStorage.collection
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
        params.txs.map(async (tx: IXrpTransaction) => {
          const { txid, wallets } = tx;

          return {
            updateOne: {
              filter: { txid, chain, network },
              update: {
                $set: {
                  ...tx,
                  blockTimeNormalized: tx.blockTimeNormalized || blockTimeNormalized,
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

  async addCoins(params: {
    coins: Array<IXrpCoin>;
    height?: number;
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
    let { chain, height, network, parentChain, forkHeight } = params;
    if (parentChain && forkHeight && height != undefined && height < forkHeight) {
      const parentChainCoins = await CoinStorage.collection
        .find({ blockHeight: height, chain: parentChain, network })
        .toArray();
      return parentChainCoins.map((coin: IXrpCoin) => {
        const { mintTxid } = coin;

        return {
          updateOne: {
            filter: {
              mintTxid,
              mintIndex: coin.mintIndex,
              chain,
              network
            },
            update: {
              $set: {
                ...coin,
                wallets: []
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        };
      });
    } else {
      return params.coins.map((coin: IXrpCoin) => {
        const { mintTxid, wallets, address } = coin;
        return {
          updateOne: {
            filter: {
              mintTxid,
              mintIndex: coin.mintIndex,
              chain,
              network
            },
            update: {
              $set: {
                chain,
                network,
                address,
                mintHeight: coin.mintHeight || height,
                coinbase: coin.coinbase,
                value: coin.value
              },
              $setOnInsert: {
                wallets
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        };
      });
    }
  }

  getTransactions(params: { query: any; options: StreamingFindOptions<IXrpTransaction> }) {
    let originalQuery = params.query;
    const { query, options } = Storage.getFindOptions(this, params.options);
    const finalQuery = Object.assign({}, originalQuery, query);
    return this.collection.find(finalQuery, options).addCursorFlag('noCursorTimeout', true);
  }

  _apiTransform(
    tx: IXrpTransaction | Partial<MongoBound<IXrpTransaction>>,
    options?: TransformOptions
  ): XrpTransactionJSON | string {
    const transaction: XrpTransactionJSON = {
      txid: tx.txid || '',
      network: tx.network || '',
      chain: tx.chain || '',
      blockHeight: valueOrDefault(tx.blockHeight, -1),
      blockHash: tx.blockHash || '',
      blockTime: tx.blockTime ? tx.blockTime.toISOString() : '',
      blockTimeNormalized: tx.blockTimeNormalized ? tx.blockTimeNormalized.toISOString() : '',
      fee: valueOrDefault(tx.fee, -1),
      value: valueOrDefault(tx.value, -1),
      from: tx.from || '',
      nonce: valueOrDefault(tx.nonce, -1),
      to: valueOrDefault(tx.to, ''),
      currency: valueOrDefault(tx.currency, 'XRP'),
      invoiceID: valueOrDefault(tx.invoiceID, '')
    };
    if (options && options.object) {
      return transaction;
    }
    return JSON.stringify(transaction);
  }
}
export let XrpTransactionStorage = new XrpTransactionModel();
