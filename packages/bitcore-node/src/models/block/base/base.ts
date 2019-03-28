import { BaseModel, MongoBound } from '../../base';
import { IBlock } from '../../../types/Block';
import { StorageService } from '../../../services/storage';
import { TransformOptions } from '../../../types/TransformOptions';
export class BlockModel<T extends IBlock> extends BaseModel<T> {
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

  async getLocalTip({ chain, network }) {
    return await this.collection.findOne({ chain, network, processed: true }, { sort: { height: -1 } });
  }

  _apiTransform(block: Partial<MongoBound<T>>, options?: TransformOptions): any {
    const transform = {
      _id: block._id,
      chain: block.chain,
      network: block.network,
      hash: block.hash,
      height: block.height,
      size: block.size,
      merkleRoot: block.merkleRoot,
      time: block.time,
      timeNormalized: block.timeNormalized,
      nonce: block.nonce,
      /*
       *difficulty: block.difficulty,
       */
      /*
       *chainWork: block.chainWork,
       */
      previousBlockHash: block.previousBlockHash,
      nextBlockHash: block.nextBlockHash,
      reward: block.reward,
      /*
       *isMainChain: block.mainChain,
       */
      transactionCount: block.transactionCount
      /*
       *minedBy: BlockModel.getPoolInfo(block.minedBy)
       */
    };
    if (options && options.object) {
      return transform;
    }
    return JSON.stringify(transform);
  }
}
export let BlockStorage = new BlockModel<IBlock>();
