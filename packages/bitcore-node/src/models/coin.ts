import { CollectionAggregationOptions, ObjectID } from 'mongodb';
import { LoggifyClass } from '../decorators/Loggify';
import { StorageService } from '../services/storage';
import { CoinJSON, SpentHeightIndicators } from '../types/Coin';
import { valueOrDefault } from '../utils/check';
import { BaseModel, MongoBound } from './base';
import { BitcoinBlockStorage } from './block';

export interface ICoin {
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
  sequenceNumber?: number;
}

@LoggifyClass
export class CoinModel extends BaseModel<ICoin> {
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
      { wallets: 1, spentHeight: 1, value: 1, mintHeight: 1 },
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

  async getBalance(params: { query: any }, options: CollectionAggregationOptions = {}) {
    let { query } = params;
    const result = await this.collection
      .aggregate<{ _id: string; balance: number }>(
        [
          { $match: query },
          {
            $project: {
              value: 1,
              status: {
                $cond: {
                  if: { $gte: ['$mintHeight', SpentHeightIndicators.minimum] },
                  then: 'confirmed',
                  else: 'unconfirmed'
                }
              },
              _id: 0
            }
          },
          {
            $group: {
              _id: '$status',
              balance: { $sum: '$value' }
            }
          }
        ],
        options
      )
      .toArray();
    return result.reduce<{ confirmed: number; unconfirmed: number; balance: number }>(
      (acc, cur) => {
        acc[cur._id] = cur.balance;
        acc.balance += cur.balance;
        return acc;
      },
      { confirmed: 0, unconfirmed: 0, balance: 0 }
    );
  }

  async getBalanceAtTime(params: { query: any; time: string; chain: string; network: string }) {
    let { query, time, chain, network } = params;
    const [block] = await BitcoinBlockStorage.collection
      .find({
        $query: {
          chain,
          network,
          timeNormalized: { $lte: new Date(time) }
        }
      })
      .limit(1)
      .sort({ timeNormalized: -1 })
      .toArray();
    const blockHeight = block!.height;
    const combinedQuery = Object.assign(
      {},
      {
        $or: [{ spentHeight: { $gt: blockHeight } }, { spentHeight: SpentHeightIndicators.unspent }],
        mintHeight: { $lte: blockHeight }
      },
      query
    );
    return this.getBalance({ query: combinedQuery }, { hint: { wallets: 1, spentHeight: 1, value: 1, mintHeight: 1 } });
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
      confirmations: valueOrDefault(coin.confirmations, -1),
      sequenceNumber: valueOrDefault(coin.sequenceNumber, undefined)
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }
}
export let CoinStorage = new CoinModel();
