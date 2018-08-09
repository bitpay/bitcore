import { CoinModel, ICoin } from './coin';
import { TransactionModel } from './transaction';
import { TransformOptions } from '../types/TransformOptions';
import { LoggifyClass } from '../decorators/Loggify';
import { Bitcoin } from '../types/namespaces/Bitcoin';
import { BaseModel } from './base';
import logger from '../logger';
import { ChainStateProvider } from '../providers/chain-state';

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
  previousBlockHash?: string;
  nextBlockHash?: string;
  transactionCount: number;
  size: number;
  bits: number;
  reward: number;
  processed: boolean;
};

export type BlockOp = {
  blockOp: { $set: Partial<IBlock> };
  mintOps: Array<any>;
  spendOps: Array<any>;
  txOps: Array<any>;
  previousBlock: {
    updateOne: { chain: string; network: string; hash: string };
    $set: { nextBlockHash: string };
  };
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

  async getBlockOp(params: {
    block: any;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    mintOps?: Array<any>;
    spendOps?: Array<any>;
    txOps?: Array<any>;
    previousBlock?: any;
  }): Promise<BlockOp> {
    const { block, chain, network, initialSyncComplete, forkHeight, parentChain } = params;
    let { previousBlock } = params;
    const header = block.header.toObject();
    const blockTime = header.time * 1000;

    if (!previousBlock) {
      previousBlock = await this.collection.findOne({ hash: header.prevHash, chain, network });
    }

    const prevHash = previousBlock != null ? previousBlock.hash : '';

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

    let parentChainCoins = new Array<ICoin>();
    if (parentChain && forkHeight && height < forkHeight && parentChainCoins.length === 0) {
      parentChainCoins = await CoinModel.collection
        .find({
          chain: parentChain,
          network,
          mintHeight: height,
          spentHeight: { $gt: -2, $lt: forkHeight }
        })
        .toArray();
    }

    const { mintOps, spendOps, txOps } = await TransactionModel.getBatchOps({
      txs: block.transactions,
      blockHash: header.hash,
      blockTime: new Date(blockTime),
      blockTimeNormalized: new Date(blockTimeNormalized),
      height: height,
      chain,
      network,
      parentChain,
      forkHeight,
      initialSyncComplete,
      parentChainCoins,
      mintOps: params.mintOps,
      spendOps: params.spendOps,
      txOps: params.txOps
    });
    return {
      blockOp: {
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
          processed: false,
          nonce: header.nonce,
          transactionCount: block.transactions.length,
          size: block.toBuffer().length,
          reward: block.transactions[0].outputAmount
        }
      },
      previousBlock: {
        updateOne: { chain, network, hash: prevHash },
        $set: { nextBlockHash: header.hash }
      },
      mintOps,
      spendOps,
      txOps
    };
  }

  async processBlockOps(blockOpsArray: Array<BlockOp>) {
    for (let index = 0; index < blockOpsArray.length; index++) {
      const blockOps = blockOpsArray[index];
      const { blockOp, previousBlock } = blockOps;
      const block = blockOp.$set;
      const { hash } = block;
      if (index > 0) {
        blockOp.$set.previousBlockHash = blockOpsArray[index - 1].blockOp.$set.hash;
        blockOpsArray[index - 1].blockOp.$set.nextBlockHash = blockOp.$set.hash;
      } else if (previousBlock) {
        await this.collection.updateOne(previousBlock.updateOne, { $set: previousBlock.$set });
        logger.debug('Updating previous block.nextBlockHash ', hash);
      }
    }
    for (let blockOps of blockOpsArray) {
      const { mintOps, spendOps, blockOp, txOps } = blockOps;
      const block = blockOp.$set;
      const { chain, network, hash } = block;
      await Promise.all([
        BlockModel.collection.update({ hash, chain, network }, blockOp, { upsert: true }),
        TransactionModel.processBatches({ mintOps, spendOps, txOps })
      ]);
      await BlockModel.collection.update({ hash: hash, chain, network }, { $set: { processed: true } });
    }
  }

  async processBlockOp(params: {
    block: any;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    blockOps: BlockOp;
  }) {
    const { block, chain, network } = params;
    const header = block.header.toObject();

    const reorg = await this.handleReorg({ header, chain, network });

    if (reorg) {
      return Promise.reject('reorg');
    }

    const { blockOps } = params;
    const { mintOps, spendOps, blockOp, txOps, previousBlock } = blockOps;
    await this.collection.update({ hash: header.hash, chain, network }, blockOp, { upsert: true });

    if (previousBlock) {
      await this.collection.updateOne(previousBlock.updateOne, { $set: previousBlock.$set });
      logger.debug('Updating previous block.nextBlockHash ', header.hash);
    }

    await TransactionModel.processBatches({ mintOps, spendOps, txOps });

    return this.collection.update({ hash: header.hash, chain, network }, { $set: { processed: true } });
  }

  async addBlock(params: {
    block: any;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
  }) {
    const blockOps = await this.getBlockOp(params);
    return this.processBlockOp({ ...params, blockOps });
  }

  getPoolInfo(coinbase: string) {
    //TODO need to make this actually parse the coinbase input and map to miner strings
    // also should go somewhere else
    return coinbase;
  }

  async handleReorg(params: { header?: Bitcoin.Block.HeaderObj; chain: string; network: string }): Promise<boolean> {
    const { header, chain, network } = params;
    const localTip = await ChainStateProvider.getLocalTip(params);
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
