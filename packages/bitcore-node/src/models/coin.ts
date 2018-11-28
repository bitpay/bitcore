import { LoggifyClass } from '../decorators/Loggify';
import { BaseModel, MongoBound } from './base';
import { ObjectID } from 'mongodb';

export type ICoin = {
  network: string;
  chain: string;
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  coinbase: boolean;
  value: number;
  address: string;
  script: Buffer;
  wallets: Array<ObjectID>;
  spentTxid: string;
  spentHeight: number;
  confirmations?: number;
};

/**
 * Number values less than 0 which indicate the spent state of a coin.
 */
export enum SpentHeightIndicators {
  /**
   * The value below which numbers are simply used as indicators.
   */
  minimum = 0,
  /**
   * The coin is spent by a transaction currently in the mempool but not yet
   * included in a block.
   */
  pending = -1,
  /**
   * The coin is unspent, and no transactions spending it have been seen.
   */
  unspent = -2,
  /**
   * The coin was minted by a transaction which can no longer confirm.
   */
  conflicting = -3
}

@LoggifyClass
class Coin extends BaseModel<ICoin> {
  constructor() {
    super('coins');
  }

  allowedPaging = [
    { key: 'mintHeight' as 'mintHeight', type: 'number' as 'number' },
    { key: 'spentHeight' as 'spentHeight', type: 'number' as 'number' }
  ];

  onConnect() {
    this.collection.createIndex({ mintTxid: 1, mintIndex: 1 }, { background: true });
    this.collection.createIndex(
      { mintTxid: 1, mintIndex: 1, chain: 1, network: 1 },
      { partialFilterExpression: { spentHeight: { $lt: 0 } } }
    );
    this.collection.createIndex(
      { address: 1, chain: 1, network: 1 },
      {
        background: true,
        partialFilterExpression: {
          spentHeight: { $lt: 0 }
        }
      }
    );
    this.collection.createIndex({ address: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, mintHeight: 1 }, { background: true });
    this.collection.createIndex({ spentTxid: 1 }, { background: true, sparse: true });
    this.collection.createIndex({ chain: 1, network: 1, spentHeight: 1 }, { background: true });
    this.collection.createIndex({ wallets: 1, spentHeight: 1, value: 1 }, { background: true, partialFilterExpression: { 'wallets.0': { $exists: true } } });
  }

  getBalance(params: { query: any }) {
    let { query } = params;
    query = Object.assign(query, {
      spentHeight: { $lt: SpentHeightIndicators.minimum },
      mintHeight: { $gt: SpentHeightIndicators.conflicting }
    });
    return this.collection
      .aggregate<{ balance: number }>([
        { $match: query },
        { $project: { value: 1, _id: 0 }},
        {
          $group: {
            _id: null,
            balance: { $sum: '$value' }
          }
        },
        { $project: { _id: false } }
      ])
      .toArray();
  }

  _apiTransform(coin: Partial<MongoBound<ICoin>>, options?: { object: boolean }) {
    let transform = {
      _id: coin._id,
      txid: coin.mintTxid,
      coinbase: coin.coinbase,
      vout: coin.mintIndex,
      spentTxid: coin.spentTxid,
      mintTxid: coin.mintTxid,
      mintHeight: coin.mintHeight,
      spentHeight: coin.spentHeight,
      address: coin.address,
      script: coin.script,
      value: coin.value,
      confirmations: coin.confirmations
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }
}
export let CoinModel = new Coin();
