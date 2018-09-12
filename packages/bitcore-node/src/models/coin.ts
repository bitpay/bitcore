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
};

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
    this.collection.createIndex({ mintTxid: 1, mintIndex: 1 });
    this.collection.createIndex({ address: 1 });
    this.collection.createIndex({ mintHeight: 1, chain: 1, network: 1 });
    this.collection.createIndex({ spentTxid: 1 }, { sparse: true });
    this.collection.createIndex({ spentHeight: 1, chain: 1, network: 1 });
    this.collection.createIndex({ wallets: 1, spentHeight: 1 }, { sparse: true });
  }

  getBalance(params: { query: any }) {
    let { query } = params;
    query = Object.assign(query, { spentHeight: { $lt: 0 } });
    return this.collection
      .aggregate<{ balance: number }>([
        { $match: query },
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

  _apiTransform(coin: MongoBound<ICoin>, options: { object: boolean }) {
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
      value: coin.value
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }
}
export let CoinModel = new Coin();
