import { Transform } from 'stream';
import logger from '../logger';
import { ITransaction } from '../models/baseTransaction';
import { CoinModel, CoinStorage } from '../models/coin';
import { TransactionModel, TransactionStorage } from '../models/transaction';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';
import { Config } from './config';

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
    for (let chainNetwork of Config.chainNetworks()) {
      const { chain, network } = chainNetwork;
      await this.processOldMempoolTxs(chain, network, MEMPOOL_AGE);
      await this.processAllInvalidTxs(chain, network);
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
              const outputs = await this.transactionModel.findAllRelatedOutputs(tx.txid);
              const invalid = outputs.find(c => c.mintHeight >= 0 || c.spentHeight >= 0);
              if (invalid) {
                return cb(new Error(`Invalid coin! ${invalid.mintTxid} `));
              }
              const spentTxids = outputs.filter(c => c.spentTxid).map(c => c.spentTxid);
              const relatedTxids = [tx.txid].concat(spentTxids);
              const uniqueTxids = Array.from(new Set(relatedTxids));
              await this.removeOldMempool(chain, network, uniqueTxids);
              logger.info(`Removed 1 transaction and ${spentTxids.length} dependent txs`);
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
              const outputs = await this.transactionModel.findAllRelatedOutputs(tx.txid);
              const invalid = outputs.find(c => c.mintHeight >= 0 || c.spentHeight >= 0);
              if (invalid) {
                return cb(new Error(`Invalid coin! ${invalid.mintTxid} `));
              }
              const spentTxids = outputs.filter(c => c.spentTxid).map(c => c.spentTxid);
              const relatedTxids = [tx.txid].concat(spentTxids);
              const uniqueTxids = Array.from(new Set(relatedTxids));
              await this.clearInvalid(uniqueTxids);
              logger.info(`Invalidated 1 transaction and ${spentTxids.length} dependent txs`);
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
    return Promise.all([
      this.transactionModel.collection.deleteMany({ chain, network, txid: { $in: txids }, blockHeight: -1 }),
      this.coinModel.collection.deleteMany({ chain, network, mintTxid: { $in: txids }, mintHeight: -1 })
    ]);
  }
}
export const Pruning = new PruningService();
