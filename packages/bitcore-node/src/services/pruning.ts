import { Transform } from 'stream';
import logger from '../logger';
import { ITransaction } from '../models/baseTransaction';
import { CoinModel, CoinStorage } from '../models/coin';
import { TransactionModel, TransactionStorage } from '../models/transaction';
import { RPC, RPCTransaction } from '../rpc';
import { SpentHeightIndicators } from '../types/Coin';
import { IUtxoNetworkConfig } from '../types/Config';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';
import { Config } from './config';

const { PRUNING_CHAIN, PRUNING_NETWORK, PRUNING_MEMPOOL_AGE, PRUNING_INTERVAL_HRS, PRUNING_DESCENDANT_LIMIT } = process.env;
const args = parseArgv([], [
  { arg: 'CHAIN', type: 'string' },
  { arg: 'NETWORK', type: 'string' },
  { arg: 'OLD', type: 'bool' },
  { arg: 'INVALID', type: 'bool' },
  { arg: 'EXIT', type: 'bool' },
  { arg: 'DRY', type: 'bool' },
  { arg: 'MEMPOOL_AGE', type: 'int' },
  { arg: 'INTERVAL_HRS', type: 'float' },
  { arg: 'DESCENDANT_LIMIT', type: 'int' },
  { arg: 'VERBOSE', type: 'bool' }
]);

const ONE_MIN = 1000 * 60;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;

const CHAIN = args.CHAIN || PRUNING_CHAIN;
const NETWORK = args.NETWORK || PRUNING_NETWORK;
const INTERVAL_HRS = args.INTERVAL_HRS || Number(PRUNING_INTERVAL_HRS) || 12;
const MEMPOOL_AGE = args.MEMPOOL_AGE || Number(PRUNING_MEMPOOL_AGE) || 7;
const DESCENDANT_LIMIT = args.DESCENDANT_LIMIT || Number(PRUNING_DESCENDANT_LIMIT) || 10;
const VERBOSE = Boolean(args.VERBOSE ?? false);

// If --DRY was given w/o a follow arg (i.e. 'true', '0', etc) assume the user wants to run a dry run (safe)
if (Object.keys(args).includes('DRY') && args.DRY === undefined) {
  args.DRY = '1';
}

if (INTERVAL_HRS > 72) {
  throw new Error('INTERVAL_HRS cannot be over 72. Consider using a cron job.');
}

export class PruningService {
  transactionModel: TransactionModel;
  coinModel: CoinModel;
  stopping = false;
  running = false;
  interval;
  rpcs: RPC[] = [];

  constructor({ transactionModel = TransactionStorage, coinModel = CoinStorage } = {}) {
    this.transactionModel = transactionModel;
    this.coinModel = coinModel;
  }

  async start() {
    logger.info('Starting Pruning Service');
    args.OLD && logger.info(`Pruning mempool txs older than ${MEMPOOL_AGE} day(s)`);
    args.INVALID && logger.info('Pruning conflicting mempool txs');
    args.DRY && logger.info('Pruning service DRY RUN');
    
    this.registerRpcs();

    if (args.EXIT) {
      this.detectAndClear().then(() => {
        process.emit('SIGINT', 'SIGINT');
      });
    } else {
      logger.info('Pruning service interval (hours): ' + INTERVAL_HRS);
      this.interval = setInterval(this.detectAndClear.bind(this), INTERVAL_HRS * ONE_HOUR);
    }
  }

  async stop() {
    logger.info('Stopping Pruning Service');
    this.stopping = true;
    clearInterval(this.interval);
  }

  registerRpcs() {
    const chainNetworks = CHAIN ? [{ chain: CHAIN, network: NETWORK }] : Config.chainNetworks();
    for (const chainNetwork of chainNetworks) {
      const config: IUtxoNetworkConfig = Config.chainConfig(chainNetwork) as IUtxoNetworkConfig;
      if (!config.rpc) {
        continue;
      }
      this.rpcs[`${chainNetwork.chain}:${chainNetwork.network}`] = new RPC(config.rpc.username, config.rpc.password, config.rpc.host, config.rpc.port);
    }
  }

  async detectAndClear() {
    if (this.running) { return; }
    this.running = true;

    try {
      if (CHAIN && NETWORK) {
        args.OLD && await this.processOldMempoolTxs(CHAIN, NETWORK, MEMPOOL_AGE);
        args.INVALID && await this.processAllInvalidTxs(CHAIN, NETWORK);
      } else {
        for (let chainNetwork of Config.chainNetworks()) {
          const { chain, network } = chainNetwork;
          if (!chain || !network) {
            throw new Error('Config structure should contain both a chain and network');
          }
          args.OLD && await this.processOldMempoolTxs(chain, network, MEMPOOL_AGE);
          args.INVALID && await this.processAllInvalidTxs(chain, network);
        }
      }
    } catch (err: any) {
      logger.error('Pruning Error: ' + err.stack || err.message || err);
    } finally {
      this.running = false;
    }
  }

  async processOldMempoolTxs(chain: string, network: string, days: number) {
    const oldTime = new Date(Date.now() - days * ONE_DAY);
    const count = await this.transactionModel.collection.countDocuments({
      chain,
      network,
      blockHeight: SpentHeightIndicators.pending,
      blockTimeNormalized: { $lt: oldTime }
    });
    logger.info(`Found ${count} outdated ${chain} ${network} mempool txs`);
    let rmCount = 0;
    await new Promise((resolve, reject) => {
      this.transactionModel.collection
        .find({ chain, network, blockHeight: SpentHeightIndicators.pending, blockTimeNormalized: { $lt: oldTime } })
        .sort(count > 5000 ? { chain: 1, network: 1, blockTimeNormalized: 1 } : {})
        .pipe(
          new Transform({
            objectMode: true,
            transform: async (data: any, _, cb) => {
              if (this.stopping) {
                return cb(new Error('Stopping'));
              }
              const tx = data as ITransaction;
              try {
                const nodeTx: RPCTransaction = await this.rpcs[`${chain}:${network}`].getTransaction(tx.txid);
                if (nodeTx) {
                  logger.warn(`Tx ${tx.txid} is still in the mempool${VERBOSE ? ': %o' : ''}`, nodeTx);
                  return cb();
                }
              } catch (err: any) {
                if (err.code !== -5) { // -5: No such mempool or blockchain transaction. Use gettransaction for wallet transactions.
                  logger.error(`Error checking tx ${tx.txid} in the mempool: ${err.message}`);
                  return cb();
                }
              }
              logger.info(`Finding ${tx.txid} outputs and dependent outputs`);
              const outputGenerator = this.transactionModel.yieldRelatedOutputs(tx.txid);
              let spentTxids = new Set<string>();
              for await (const coin of outputGenerator) {
                if (coin.mintHeight >= 0 || coin.spentHeight >= 0) {
                  logger.error(`Cannot prune coin! ${coin.mintTxid}`);
                  return cb();
                }
                if (coin.spentTxid) {
                  spentTxids.add(coin.spentTxid);
                  if (spentTxids.size > DESCENDANT_LIMIT) {
                    logger.warn(`${tx.txid} has too many decendants`);
                    return cb();
                  }
                }
              }
              spentTxids.add(tx.txid);
              rmCount += spentTxids.size;
              const uniqueTxids = Array.from(spentTxids);
              await this.removeOldMempool(chain, network, uniqueTxids);
              logger.info(`Removed tx ${tx.txid} and ${spentTxids.size - 1} dependent txs`);
              return cb();
            }
          })
        )
        .on('finish', resolve)
        .on('error', reject);
    });
    logger.info(`Removed all pending txs older than ${days} days: ${rmCount}`);
  }

  async processAllInvalidTxs(chain, network) {
    const count = await this.transactionModel.collection.countDocuments({
      chain,
      network,
      blockHeight: SpentHeightIndicators.conflicting
    });
    logger.info(`Found ${count} invalid ${chain} ${network} txs`);
    await new Promise((resolve, reject) => {
      this.transactionModel.collection
        .find({ chain, network, blockHeight: SpentHeightIndicators.conflicting })
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
              for await (const coin of outputGenerator) {
                if (coin.mintHeight >= 0 || coin.spentHeight >= 0) {
                  return cb(new Error(`Invalid coin! ${coin.mintTxid} `));
                }
                if (coin.spentTxid) {
                  spentTxids.add(coin.spentTxid);
                  if (spentTxids.size > DESCENDANT_LIMIT) {
                    logger.warn(`${tx.txid} has too many decendants`);
                    return cb();
                  }
                }
              }
              spentTxids.add(tx.txid);
              const uniqueTxids = Array.from(spentTxids);
              await this.clearInvalid(uniqueTxids);
              logger.info(`Invalidated tx ${tx.txid} and ${spentTxids.size - 1} dependent txs`);
              cb();
            }
          })
        )
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  async clearInvalid(invalidTxids: Array<string>) {
    logger.info(`${args.DRY ? 'DRY RUN - ' : ''}Invalidating ${invalidTxids.length} txids`);
    if (args.DRY) {
      return;
    }
    return Promise.all([
      // Set all invalid txs to conflicting status
      this.transactionModel.collection.updateMany(
        { txid: { $in: invalidTxids } },
        { $set: { blockHeight: SpentHeightIndicators.conflicting } }
      ),
      // Set all coins that were pending to be spent by an invalid tx back to unspent
      this.coinModel.collection.updateMany(
        { spentTxid: { $in: invalidTxids } },
        { $set: { spentHeight: SpentHeightIndicators.unspent } }
      ),
      // Set all coins that were created by invalid txs to conflicting status
      this.coinModel.collection.updateMany(
        { mintTxid: { $in: invalidTxids } },
        { $set: { mintHeight: SpentHeightIndicators.conflicting } }
      )
    ]);
  }

  async removeOldMempool(chain, network, txids: Array<string>) {
    logger.info(`${args.DRY ? 'DRY RUN - ' : ''}Removing ${txids.length} txids`);
    if (args.DRY) {
      return;
    }
    return Promise.all([
      this.transactionModel.collection.updateMany(
        { chain, network, txid: { $in: txids }, blockHeight: SpentHeightIndicators.pending },
        { $set: { blockHeight: SpentHeightIndicators.expired } }
      ),
      this.coinModel.collection.updateMany(
        { chain, network, mintTxid: { $in: txids }, mintHeight: SpentHeightIndicators.pending },
        { $set: { mintHeight: SpentHeightIndicators.expired } }
      ),
      this.coinModel.collection.updateMany(
        { chain, network, spentTxid: { $in: txids }, spentHeight: SpentHeightIndicators.pending },
        { $set: { spentTxid: null, spentHeight: SpentHeightIndicators.unspent } }
      )
    ]);
  }
}
export const Pruning = new PruningService();
