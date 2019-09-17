import { TransactionStorage, TransactionModel } from '../models/transaction';
import { CoinStorage, CoinModel } from '../models/coin';
import logger from '../logger';
import { Config } from './config';
import '../utils/polyfills';

import parseArgv from '../utils/parseArgv';
import { partition } from '../utils/partition';
let args = parseArgv([], ['EXIT']);

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
      await this.detectInvalidMempoolCoins(chain, network);
      const invalids = this.detectInvalidCoins(chain, network);
      for await (const invalidCoins of invalids) {
        if (this.stopping) {
          return;
        }
        const txids = invalidCoins.map(c => c.mintTxid);
        await this.clearInvalid(txids);
      }
    }
  }

  async detectInvalidMempoolCoins(chain, network) {
    const txs = await this.transactionModel.collection.find({ chain, network, blockHeight: -3 }).toArray();
    for (let groups of partition(txs, 1000)) {
      const updated = await this.coinModel.collection.updateMany(
        { chain, network, mintTxid: { $in: groups.map(tx => tx.txid) }, mintHeight: -1 },
        { $set: { mintHeight: -3 } }
      );
      logger.info('Mempool coins updated', updated);
    }
  }

  async *detectInvalidCoins(chain, network) {
    const coins = await this.coinModel.collection.find({ chain, network, mintHeight: -3 }).toArray();
    logger.info('Pruning worker found', coins.length, 'invalid coins for ', chain, network);
    for (let coin of coins) {
      if (coin.spentTxid) {
        yield await this.scanForInvalid(coin.spentTxid);
      }
    }
  }

  async scanForInvalid(spentTxid: string) {
    const foundCoins = await this.coinModel.collection.find({ mintTxid: spentTxid, mintHeight: { $ne: -3 } }).toArray();
    if (foundCoins.length === 0) {
      return foundCoins;
    } else {
      for (let coin of foundCoins) {
        if (coin.spentTxid) {
          foundCoins.push(...(await this.scanForInvalid(coin.spentTxid)));
        }
      }
    }
    return foundCoins;
  }

  async clearInvalid(invalidTxids: Array<string>) {
    logger.info('Pruning worker clearing', invalidTxids.length, 'txids');
    return Promise.all([
      this.transactionModel.collection.updateMany({ txid: { $in: invalidTxids } }, { $set: { blockHeight: -3 } }),
      this.coinModel.collection.updateMany({ mintTxid: { $in: invalidTxids } }, { $set: { mintHeight: -3 } })
    ]);
  }
}
export const Pruning = new PruningService();
