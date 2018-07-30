import { CoinModel } from './coin';
import { TransactionModel } from './transaction';
import { TransformOptions } from '../types/TransformOptions';
import { LoggifyClass } from '../decorators/Loggify';
import { Bitcoin } from '../types/namespaces/Bitcoin';
import { BaseModel } from './base';
import logger from '../logger';
import { InternalState } from '../providers/chain-state';

export type IBlock = {
  chain: string;
  network: string;
  height: number;
  hash: string;
  version: number;
  merkleRoot: string;
  time: Date;
  timeNormalized: Date;
  nonce: number;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  size: number;
  bits: number;
  reward: number;
  processed: boolean;
};

@LoggifyClass
export class Block extends BaseModel<IBlock> {
  constructor() {
    super('blocks');
  }

  allowedPaging = [
    {
      key: 'height' as 'height',
      type: 'number' as 'number'
    }
  ];

  async onConnect() {
    this.collection.createIndex({ hash: 1 });
    this.collection.createIndex({ chain: 1, network: 1, processed: 1, height: -1 });
    this.collection.createIndex({ chain: 1, network: 1, timeNormalized: 1 });
    this.collection.createIndex({ previousBlockHash: 1 });
  }

  async addBlock(params: {
    block: any;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
  }) {
    const { block, chain, network, parentChain, forkHeight, initialSyncComplete } = params;
    const header = block.header.toObject();
    const blockTime = header.time * 1000;

    const reorg = await this.handleReorg({ header, chain, network });

    if (reorg) {
      return Promise.reject('reorg');
    }

    const previousBlock = await this.collection.findOne({ hash: header.prevHash, chain, network });

    const blockTimeNormalized = (() => {
      const prevTime = previousBlock ? previousBlock.timeNormalized : null;
      if (prevTime && blockTime <= prevTime.getTime()) {
        return prevTime.getTime() + 1;
      } else {
        return blockTime;
      }
    })();

    const height = (previousBlock && previousBlock.height + 1) || 1;
    logger.debug('Setting blockheight', height);

    await this.collection.update(
      { hash: header.hash, chain, network },
      {
        $set: {
          chain,
          network,
          hash: block.hash,
          height,
          version: header.version,
          previousBlockHash: header.prevHash,
          merkleRoot: header.merkleRoot,
          time: new Date(blockTime),
          timeNormalized: new Date(blockTimeNormalized),
          bits: header.bits,
          nonce: header.nonce,
          transactionCount: block.transactions.length,
          size: block.toBuffer().length,
          reward: block.transactions[0].outputAmount
        }
      },
      { upsert: true }
    );

    if (previousBlock) {
      await this.collection.updateOne(
        { chain, network, hash: previousBlock.hash },
        { $set: { nextBlockHash: header.hash } }
      );
      logger.debug('Updating previous block.nextBlockHash ', header.hash);
    }

    await TransactionModel.batchImport({
      txs: block.transactions,
      blockHash: header.hash,
      blockTime: new Date(blockTime),
      blockTimeNormalized: new Date(blockTimeNormalized),
      height: height,
      chain,
      network,
      parentChain,
      forkHeight,
      initialSyncComplete
    });

    return this.collection.update({ hash: header.hash, chain, network }, { $set: { processed: true } });
  }

  getPoolInfo(coinbase: string) {
    //TODO need to make this actually parse the coinbase input and map to miner strings
    // also should go somewhere else
    return coinbase;
  }

  async handleReorg(params: { header?: Bitcoin.Block.HeaderObj; chain: string; network: string }): Promise<boolean> {
    const { header, chain, network } = params;
    const localTip = await InternalState.getLocalTip(params);
    if (header && localTip && localTip.hash === header.prevHash) {
      return false;
    }
    if (!localTip || localTip.height === 0) {
      return false;
    }
    logger.info(`Resetting tip to ${localTip.previousBlockHash}`, { chain, network });
    await this.collection.remove({ chain, network, height: { $gte: localTip.height } });
    await TransactionModel.collection.remove({ chain, network, blockHeight: { $gte: localTip.height } });
    await CoinModel.collection.remove({ chain, network, mintHeight: { $gte: localTip.height } });
    await CoinModel.collection.update(
      { chain, network, spentHeight: { $gte: localTip.height } },
      { $set: { spentTxid: null, spentHeight: -1 } },
      { multi: true }
    );

    logger.debug('Removed data from above blockHeight: ', localTip.height);
    return true;
  }

  _apiTransform(block: IBlock, options: TransformOptions): any {
    const transform = {
      chain: block.chain,
      network: block.network,
      hash: block.hash,
      height: block.height,
      version: block.version,
      size: block.size,
      merkleRoot: block.merkleRoot,
      time: block.time,
      timeNormalized: block.timeNormalized,
      nonce: block.nonce,
      bits: block.bits,
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

export let BlockModel = new Block();
