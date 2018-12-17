import { LoggifyClass } from '../decorators/Loggify';
import { BaseModel, MongoBound } from './base';
import { ObjectID } from 'mongodb';
import { SpentHeightIndicators, CoinJSON } from '../types/Coin';

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
    this.collection.createIndex(
      { wallets: 1, spentHeight: 1, value: 1 },
      { background: true, partialFilterExpression: { 'wallets.0': { $exists: true } } }
    );
    this.collection.createIndex(
      { wallets: 1, spentTxid: 1 },
      { background: true, partialFilterExpression: { 'wallets.0': { $exists: true } } }
    );
    this.collection.createIndex(
      { wallets: 1, mintTxid: 1 },
      { background: true, partialFilterExpression: { 'wallets.0': { $exists: true } } }
    );
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
        { $project: { value: 1, _id: 0 } },
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

  resolveAuthhead(mintTxid: string, chain?: string, network?: string) {
    return this.collection
      .aggregate<{
        chain: string;
        network: string;
        authbase: string;
        identityOutputs: ICoin[];
      }>([
        {
          $match: {
            mintTxid: mintTxid.toLowerCase(),
            mintIndex: 0,
            ...(typeof chain === 'string' ? { chain: chain.toString() } : {}),
            ...(typeof network === 'string' ? { network: network.toString() } : {})
          }
        },
        {
          $graphLookup: {
            from: 'coins',
            startWith: '$spentTxid',
            connectFromField: 'spentTxid',
            connectToField: 'mintTxid',
            as: 'authheads',
            maxDepth: 1000000,
            restrictSearchWithMatch: {
              mintIndex: 0
            }
          }
        },
        {
          $project: {
            chain: '$chain',
            network: '$network',
            authbase: '$mintTxid',
            identityOutputs: {
              $filter: {
                input: '$authheads',
                as: 'authhead',
                cond: {
                  $and: [
                    {
                      $lte: ['$$authhead.spentHeight', -1]
                    },
                    {
                      $eq: ['$$authhead.chain', '$chain']
                    },
                    {
                      $eq: ['$$authhead.network', '$network']
                    }
                  ]
                }
              }
            }
          }
        }
      ])
      .toArray();
  }

  _apiTransform(coin: Partial<MongoBound<ICoin>>, options?: { object: boolean }): any {
    const transform: CoinJSON = {
      _id: coin._id ? coin._id.toString() : '',
      chain: coin.chain ? coin.chain.toString() : '',
      network: coin.network ? coin.network.toString() : '',
      coinbase: coin.coinbase || false,
      mintIndex: coin.mintIndex || -1,
      spentTxid: coin.spentTxid ? coin.spentTxid.toString() : '',
      mintTxid: coin.mintTxid ? coin.mintTxid.toString() : '',
      mintHeight: coin.mintHeight || -1,
      spentHeight: coin.spentHeight || SpentHeightIndicators.error,
      address: coin.address ? coin.address.toString() : '',
      script: coin.script ? coin.script.toString('hex') : '',
      value: coin.value || -1,
      confirmations: coin.confirmations || -1
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }
}
export let CoinModel = new Coin();
