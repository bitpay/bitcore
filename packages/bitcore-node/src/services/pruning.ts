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

const { PRUNING_CHAIN, PRUNING_NETWORK, PRUNING_MEMPOOL_AGE, PRUNING_OLD_INTERVAL_HRS, PRUNING_INV_INTERVAL_MINS, PRUNING_DESCENDANT_LIMIT } = process.env;
const args = parseArgv([], [
  { arg: 'CHAIN', type: 'string' },
  { arg: 'NETWORK', type: 'string' },
  { arg: 'OLD', type: 'bool' },
  { arg: 'INVALID', type: 'bool' },
  { arg: 'EXIT', type: 'bool' },
  { arg: 'DRY', type: 'bool' },
  { arg: 'MEMPOOL_AGE', type: 'int' },
  { arg: 'OLD_INTERVAL_HRS', type: 'float' },
  { arg: 'INV_INTERVAL_MINS', type: 'float' },
  { arg: 'INV_MATURE_LEN', type: 'int' },
  { arg: 'DESCENDANT_LIMIT', type: 'int' },
  { arg: 'VERBOSE', type: 'bool' }
]);

const ONE_MIN = 1000 * 60;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;

const CHAIN = args.CHAIN || PRUNING_CHAIN;
const NETWORK = args.NETWORK || PRUNING_NETWORK;
const OLD_INTERVAL_HRS = args.OLD_INTERVAL_HRS || Number(PRUNING_OLD_INTERVAL_HRS) || 12;
const INV_INTERVAL_MINS = args.INV_INTERVAL_MINS || Number(PRUNING_INV_INTERVAL_MINS) || 10;
const INV_MATURE_LEN = args.INV_MATURE_LEN || 3; // using || means INV_MATURE_LEN needs to be >0
const MEMPOOL_AGE = args.MEMPOOL_AGE || Number(PRUNING_MEMPOOL_AGE) || 7;
const DESCENDANT_LIMIT = args.DESCENDANT_LIMIT || Number(PRUNING_DESCENDANT_LIMIT) || 10;
const VERBOSE = Boolean(args.VERBOSE ?? false);

// If --DRY was given w/o a follow arg (i.e. 'true', '0', etc) assume the user wants to run a dry run (safe)
if (Object.keys(args).includes('DRY') && args.DRY === undefined) {
  args.DRY = '1';
}

if (OLD_INTERVAL_HRS > 72) {
  throw new Error('OLD_INTERVAL_HRS cannot be over 72 hours. Consider using a cron job.');
}

if (INV_INTERVAL_MINS > 60 * 24 * 3) {
  throw new Error('INV_INTERVAL_MINS cannot be over 72 hours. Consider using a cron job.');
} else if (INV_INTERVAL_MINS < 2) {
  throw new Error('INV_INTERVAL_MINS must be at least 2 minutes');
}

export class PruningService {
  transactionModel: TransactionModel;
  coinModel: CoinModel;
  stopping = false;
  interval;
  rpcs: RPC[] = [];
  runningOld = false;
  runningInvalid = false;
  lastRunTimeOld = 0;
  lastRunTimeInvalid = 0;

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
      logger.info('Pruning service OLD interval (hours): ' + OLD_INTERVAL_HRS);
      logger.info('Pruning service INVALID interval (minutes): ' + INV_INTERVAL_MINS);
      this.interval = setInterval(this.detectAndClear.bind(this), ONE_MIN);
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
    try {
      if (CHAIN && NETWORK) {
        args.OLD && await this.processOldMempoolTxs(CHAIN, NETWORK, MEMPOOL_AGE);
        args.INVALID && await this.processAllInvalidTxs(CHAIN, NETWORK);
      } else {
        for (const chainNetwork of Config.chainNetworks()) {
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
    }
  }

  async processOldMempoolTxs(chain: string, network: string, days: number) {
    if (this.runningOld) {
      return;
    }
    this.runningOld = true;

    try {
      if (Date.now() - this.lastRunTimeOld < OLD_INTERVAL_HRS * ONE_HOUR) {
        return;
      }
      logger.info('========== OLD STARTED ===========');

      const oldTime = new Date(Date.now() - days * ONE_DAY);
      const count = await this.transactionModel.collection.countDocuments({
        chain,
        network,
        blockHeight: SpentHeightIndicators.pending,
        blockTimeNormalized: { $lt: oldTime }
      });
      logger.info(`Found ${count} outdated ${chain}:${network} mempool txs`);
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
                const spentTxids = new Set<string>();
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
      logger.info(`Removed all pending ${chain}:${network} txs older than ${days} days: ${rmCount}`);
      this.lastRunTimeOld = Date.now();
      logger.info('========== OLD FINISHED ===========');
    } catch (err: any) {
      logger.error(`Error processing old mempool txs: ${err.stack || err.message || err}`);
    } finally {
      this.runningOld = false;
    }
  }

  async processAllInvalidTxs(chain, network) {
    if (this.runningInvalid) {
      return;
    }
    this.runningInvalid = true;

    try {
      if (Date.now() - this.lastRunTimeInvalid < INV_INTERVAL_MINS * ONE_MIN) {
        return;
      }
      logger.info('========== INVALID STARTED ===========');

      const count = await this.coinModel.collection.countDocuments({ chain, network, mintHeight: SpentHeightIndicators.pending });
      logger.info(`Found ${count} pending ${chain}:${network} TXOs`);

      // Note, realCount <= count since the coinStream returns coins dynamically and related coins are updated.
      // The caveat is that new coins could be added to the stream while we are iterating over it.
      let realCount = 0;
      let invalidCount = 0;
      const seen = new Set<string>();
      const voutStream = this.coinModel.collection.find({ chain, network, mintHeight: SpentHeightIndicators.pending });
      for await (const vout of voutStream) {
        if (this.stopping) {
          break;
        }
        realCount++;
        if (seen.has(vout.mintTxid)) {
          continue;
        }
        seen.add(vout.mintTxid);
        const tx = await this.transactionModel.collection.findOne({ chain, network, txid: vout.mintTxid });
        if (!tx) {
          logger.error(`Coin ${vout.mintTxid} has no corresponding tx`);
          continue;
        }
        if (tx.replacedByTxid) {
          if (await this.invalidateTx(chain, network, tx)) {
            invalidCount++;
          }
        } else {
          // Check if the parent tx was replaced since the sync process marks immediate replacements as replaced, but not descendants
          const vins = await this.coinModel.collection.find({ chain, network, spentTxid: vout.mintTxid }).toArray();
          const vinTxs = await this.transactionModel.collection.find({ chain, network, txid: { $in: vins.map(vin => vin.mintTxid) } }).toArray();
          for (const tx of vinTxs) {
            if (tx.replacedByTxid) {
              if (await this.invalidateTx(chain, network, tx)) {
                invalidCount++;
              };
            }
          }
        }
      }
      logger.info(`Invalidated ${invalidCount} (processed ${realCount}) pending TXOs for ${chain}:${network}`);
      this.lastRunTimeInvalid = Date.now();
      logger.info('========== INVALID FINISHED ===========');
    } catch (err: any) {
      logger.error(`Error processing invalid txs: ${err.stack || err.message || err}`);
    } finally {
      this.runningInvalid = false;
    }
  }

  /**
   * Invalidate a transaction and its descendants
   * @param {string} chain
   * @param {string} network
   * @param {ITransaction} tx Transaction object with replacedByTxid
   * @returns 
   */
  async invalidateTx(chain: string, network: string, tx: ITransaction) {
    if (tx.blockHeight! >= 0) {
      // This means that downstream coins are still pending when they should be marked as confirmed.
      // This indicates a bug in the sync process.
      logger.warn(`Tx ${tx.txid} is already mined`);
      return false;
    }
    if (!tx.replacedByTxid) {
      logger.warn(`Given tx has no replacedByTxid: ${tx.txid}`);
      return false;
    }
    let rTx = await this.transactionModel.collection.findOne({ chain, network, txid: tx.replacedByTxid });
    const txids = [tx.txid];
    while (rTx?.replacedByTxid && rTx?.blockHeight! < 0 && !txids.includes(rTx?.txid)) {
      // replacement tx has also been replaced
      // Note: rTx.txid === tx.txid may happen if tx.replacedByTxid => rTx.txid and rTx.replacedByTxid => tx.txid.
      //  This might happen if tx was rebroadcast _after_ being marked as replaced by rTx, thus marking rTx as replaced by tx.
      //  Without this check, we could end up in an infinite loop where the two txs keep finding each other as unconfirmed replacements.
      txids.push(rTx.txid);
      rTx = await this.transactionModel.collection.findOne({ chain, network, txid: rTx.replacedByTxid });
    }
    // Re-org protection
    const tipHeight = await this.rpcs[`${chain}:${network}`].getBlockHeight();
    const isMature = rTx?.blockHeight! > SpentHeightIndicators.pending && tipHeight - rTx?.blockHeight! > INV_MATURE_LEN;
    const isExpired = rTx?.blockHeight! === SpentHeightIndicators.expired; // Set by --OLD
    if (isMature || isExpired) {
      try {
        const nConfs = tipHeight - rTx?.blockHeight!;
        logger.info(`${args.DRY ? 'DRY RUN - ' : ''}Invalidating ${tx.txid} with replacement => ${tx.replacedByTxid} (${isExpired ? 'expired' : nConfs})`);
        if (args.DRY) {
          return true;
        }        
        await this.transactionModel._invalidateTx({
          chain,
          network,
          invalidTxid: tx.txid,
          replacedByTxid: tx.replacedByTxid
        });
        return true;
      } catch (err: any) {
        logger.error(`Error invalidating tx ${tx.txid}: ${err.stack || err.message || err}`);
      }
    } else {
      logger.info(`Skipping invalidation of ${tx.txid} with immature replacement => ${tx.replacedByTxid}`);
    }
    return false;
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
