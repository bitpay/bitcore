import { StorageService } from '../services/storage';
import { IBlock } from '../types/Block';
import { ChainNetwork } from '../types/ChainNetwork';
import { TransformOptions } from '../types/TransformOptions';
import { BaseModel, MongoBound } from './base';

export interface IBlock {
  chain: string;
  confirmations?: number;
  network: string;
  height: number;
  hash: string;
  time: Date;
  timeNormalized: Date;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  size: number;
  reward: number;
  processed: boolean;
}

export abstract class BaseBlock<T extends IBlock> extends BaseModel<T> {
  constructor(storage?: StorageService) {
    super('blocks', storage);
  }

  allowedPaging = [
    {
      key: 'height' as 'height',
      type: 'number' as 'number'
    }
  ];

  async onConnect() {
    this.collection.createIndex({ hash: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, processed: 1, height: -1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, timeNormalized: 1 }, { background: true });
    this.collection.createIndex({ previousBlockHash: 1 }, { background: true });
  }

  getPoolInfo(coinbase: string) {
    // TODO need to make this actually parse the coinbase input and map to miner strings
    // also should go somewhere else
    return coinbase;
  }

  async getLocalTip({ chain, network }) {
    const tip = await this.collection.findOne({ chain, network, processed: true }, { sort: { height: -1 } });
    return tip as IBlock;
  }

  public async validateLocatorHashes(params: ChainNetwork) {
    const { chain, network } = params;
    let headers = new Array<IBlock>();
    const locatorBlocks = await this.collection
      .find({
        processed: true,
        chain,
        network
      })
      .sort({ height: -1 })
      .limit(100)
      .project({ hash: 1, previousBlockHash: 1, nextBlockHash: 1 })
      .addCursorFlag('noCursorTimeout', true)
      .toArray();

    for (let i = 0; i < locatorBlocks.length; i++) {
      let prevMatch = true;
      let nextMatch = true;
      if (i != 0) {
        prevMatch = prevMatch && locatorBlocks[i].nextBlockHash === locatorBlocks[i - 1].hash;
        nextMatch = nextMatch && locatorBlocks[i].hash === locatorBlocks[i - 1].previousBlockHash;
      }
      if (i != locatorBlocks.length - 1) {
        prevMatch = prevMatch && locatorBlocks[i].hash === locatorBlocks[i + 1].nextBlockHash;
        nextMatch = nextMatch && locatorBlocks[i].previousBlockHash === locatorBlocks[i + 1].hash;
      }
      if (!prevMatch || !nextMatch) {
        headers.push(locatorBlocks[i]);
      }
    }
    return headers;
  }

  abstract _apiTransform(block: T | Partial<MongoBound<T>>, options?: TransformOptions): any;
}
