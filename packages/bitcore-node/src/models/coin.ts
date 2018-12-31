import { LoggifyClass } from '../decorators/Loggify';
import { BaseModel, MongoBound } from './base';
import { ObjectID } from 'mongodb';
import { SpentHeightIndicators, CoinJSON } from '../types/Coin';
import { valueOrDefault } from '../utils/check';
import { StorageService } from '../services/storage';

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
class CoinModel extends BaseModel<ICoin> {
  constructor(storage?: StorageService) {
    super('coins', storage);
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

  async getBalance(params: { query: any }): Promise<{ confirmed: number, unconfirmed: number, balance: number }> {
    let { query } = params;
    query = Object.assign(query, {
      spentHeight: { $lt: SpentHeightIndicators.minimum },
      mintHeight: { $gt: SpentHeightIndicators.conflicting }
    });
    const result =  await this.collection
      .aggregate<{ _id: string, balance: number }>([
        { $match: query },
        { 
          $project: { 
            value: 1, 
            status: {$cond: { if: { $gte: ['$mintHeight', SpentHeightIndicators.minimum]}, then: 'confirmed', else: 'unconfirmed' }}, 
            _id: 0 
          } 
        },
        {
          $group: {
            _id: '$status',
            balance: { $sum: '$value' }

          }
        }
      ])
      .toArray();
    return result.reduce((acc, cur) => { 
      acc[cur._id] = cur.balance; 
      acc.balance += cur.balance;
      return acc; 
    }, { confirmed: 0, unconfirmed: 0, balance: 0 }) as { confirmed: number, unconfirmed: number, balance: number };
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
            ...(typeof chain === 'string' ? { chain } : {}),
            ...(typeof network === 'string' ? { network } : {})
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
      _id: valueOrDefault(coin._id, new ObjectID()).toHexString(),
      chain: valueOrDefault(coin.chain, ''),
      network: valueOrDefault(coin.network, ''),
      coinbase: valueOrDefault(coin.coinbase, false),
      mintIndex: valueOrDefault(coin.mintIndex, -1),
      spentTxid: valueOrDefault(coin.spentTxid, ''),
      mintTxid: valueOrDefault(coin.mintTxid, ''),
      mintHeight: valueOrDefault(coin.mintHeight, -1),
      spentHeight: valueOrDefault(coin.spentHeight, SpentHeightIndicators.error),
      address: valueOrDefault(coin.address, ''),
      script: valueOrDefault(coin.script, Buffer.alloc(0)).toString('hex'),
      value: valueOrDefault(coin.value, -1),
      confirmations: valueOrDefault(coin.confirmations, -1)
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }
}
export let CoinStorage = new CoinModel();
