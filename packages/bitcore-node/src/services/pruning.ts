import { Transform } from 'stream';
import logger from '../logger';
import { ITransaction } from '../models/baseTransaction';
import { CoinModel, CoinStorage } from '../models/coin';
import { TransactionModel, TransactionStorage } from '../models/transaction';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';
import { Config } from './config';

const { CHAIN, NETWORK } = process.env;
const MEMPOOL_AGE = Number(process.env.MEMPOOL_AGE) || 7;
const args = parseArgv([], ['EXIT']);

export class PruningService {
  transactionModel: TransactionModel;
  coinModel: CoinModel;
  stopping = false;

  constructor({ transactionModel = TransactionStorage, coinModel = CoinStorage } = {}) {
    this.transactionModel = transactionModel;
    this.coinModel = coinModel;
  }

  async start() {
    this.detectAndClear().then(() => {
      if (args.EXIT) {
        process.emit('SIGINT');
      }
    });
  }

  async stop() {
    logger.info('Stopping Pruning Service');
    this.stopping = true;
  }

  async detectAndClear() {
    if (CHAIN && NETWORK) {
      await this.processOldMempoolTxs(CHAIN, NETWORK, MEMPOOL_AGE);
      await this.processAllInvalidTxs(CHAIN, NETWORK);
    } else {
      for (let chainNetwork of Config.chainNetworks()) {
        const { chain, network } = chainNetwork;
        if (!chain || !network) {
          throw new Error('Config structure should contain both a chain and network');
        }
        await this.processOldMempoolTxs(chain, network, MEMPOOL_AGE);
        await this.processAllInvalidTxs(chain, network);
      }
    }
  }

  async processOldMempoolTxs(chain: string, network: string, days: number) {
    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;
    const oldTime = new Date(Date.now() - days * ONE_DAY);
    const count = await this.transactionModel.collection.countDocuments({
      chain,
      network,
      blockHeight: -1,
      blockTimeNormalized: { $lt: oldTime }
    });
    logger.info(`Found ${count} outdated ${chain} ${network} mempool txs`);
    await new Promise((resolve, reject) => {
      this.transactionModel.collection
        .find({ chain, network, blockHeight: -1, blockTimeNormalized: { $lt: oldTime } })
        .pipe(
          new Transform({
            objectMode: true,
            transform: async (data: any, _, cb) => {
              if (this.stopping) {
                return cb(new Error('Stopping'));
              }
              const tx = data as ITransaction;
              logger.info(`Finding ${tx.txid} outputs and dependent outputs`);
              const outputGenerator = this.transactionModel.yieldRelatedOutputs(tx.txid);
              let spentTxids = new Set<string>();
              let count = 0;
              for await (const coin of outputGenerator) {
                if (coin.mintHeight >= 0 || coin.spentHeight >= 0) {
                  return cb(new Error(`Invalid coin! ${coin.mintTxid} `));
                }
                count++;
                if (count > 50) {
                  throw new Error(`${tx.txid} has too many decendents`);
                }
                if (coin.spentTxid) {
                  spentTxids.add(coin.spentTxid);
                }
              }
              spentTxids.add(tx.txid);
              const uniqueTxids = Array.from(spentTxids);
              await this.removeOldMempool(chain, network, uniqueTxids);
              logger.info(`Removed ${tx.txid} transaction and ${count} dependent txs`);
              cb();
            }
          })
        )
        .on('finish', resolve)
        .on('error', reject);
    });
    logger.info(`Removed all old mempool txs within the last ${days} days`);
  }

  async processAllInvalidTxs(chain, network) {
    const count = await this.transactionModel.collection.countDocuments({
      chain,
      network,
      blockHeight: -3
    });
    logger.info(`Found ${count} invalid ${chain} ${network} txs`);
    await new Promise((resolve, reject) => {
      this.transactionModel.collection
        .find({ chain, network, blockHeight: -3 })
        .pipe(
          new Transform({
            objectMode: true,
            transform: async (data: any, _, cb) => {
              if (this.stopping) {
                return cb(new Error('Stopping'));
              }
              const tx = data as ITransaction;
              logger.info(`Invalidating ${tx.txid} outputs and dependent outputs`);
              const outputGenerator = this.transactionModel.yieldRelatedOutputs(tx.txid);
              let spentTxids = new Set<string>();
              let count = 0;
              for await (const coin of outputGenerator) {
                if (coin.mintHeight >= 0 || coin.spentHeight >= 0) {
                  return cb(new Error(`Invalid coin! ${coin.mintTxid} `));
                }
                count++;
                if (count > 50) {
                  throw new Error(`${tx.txid} has too many decendents`);
                }
                if (coin.spentTxid) {
                  spentTxids.add(coin.spentTxid);
                }
              }
              spentTxids.add(tx.txid);
              const uniqueTxids = Array.from(spentTxids);
              await this.clearInvalid(uniqueTxids);
              logger.info(`Invalidated ${tx.txid} and ${count} dependent txs`);
              cb();
            }
          })
        )
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  async clearInvalid(invalidTxids: Array<string>) {
    logger.info(`Invalidating ${invalidTxids.length} txids`);
    return Promise.all([
      this.transactionModel.collection.updateMany({ txid: { $in: invalidTxids } }, { $set: { blockHeight: -3 } }),
      this.coinModel.collection.updateMany({ mintTxid: { $in: invalidTxids } }, { $set: { mintHeight: -3 } })
    ]);
  }

  async removeOldMempool(chain, network, txids: Array<string>) {
    logger.info(`Removing ${txids.length} txids`);
    return Promise.all([
      this.transactionModel.collection.deleteMany({ chain, network, txid: { $in: txids }, blockHeight: -1 }),
      this.coinModel.collection.deleteMany({ chain, network, mintTxid: { $in: txids }, mintHeight: -1 })
    ]);
  }
}
export const Pruning = new PruningService();
