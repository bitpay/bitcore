import { valueOrDefault } from '../utils/check';
import { TransformOptions } from '../types/TransformOptions';
import { BaseModel, MongoBound } from './base';
import { IBlock } from '../types/Block';
import { StorageService } from '../services/storage';
import config from '../config';

export type IBlock = {
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
};

export abstract class BaseBlock<T extends IBlock> extends BaseModel<T> {
  constructor(storage?: StorageService) {
    super('blocks', storage);
  }

  chainTips: Mapping<Mapping<IBlock>> = {};

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
    this.wireup();
  }

  async wireup() {
    for (let chain of Object.keys(config.chains)) {
      for (let network of Object.keys(config.chains[chain])) {
        const tip = await this.getLocalTip({ chain, network });
        if (tip) {
          this.chainTips[chain] = { [network]: tip };
        }
      }
    }
  }

  updateCachedChainTip(params: { block: IBlock; chain: string; network: string }) {
    const { chain, network, block } = params;
    this.chainTips[chain] = valueOrDefault(this.chainTips[chain], {});
    this.chainTips[chain][network] = valueOrDefault(this.chainTips[chain][network], block);
    if (this.chainTips[chain][network].height < block.height) {
      this.chainTips[chain][network] = block;
    }
  }

  getPoolInfo(coinbase: string) {
    //TODO need to make this actually parse the coinbase input and map to miner strings
    // also should go somewhere else
    return coinbase;
  }

  getLocalTip({ chain, network }) {
    return this.collection.findOne({ chain, network, processed: true }, { sort: { height: -1 } });
  }

  abstract _apiTransform(block: T | Partial<MongoBound<T>>, options?: TransformOptions): any;
}
