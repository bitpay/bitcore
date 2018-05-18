import { Schema, Document, model, DocumentQuery } from 'mongoose';
import { CoinModel } from './coin';
import { TransactionModel } from './transaction';
import { TransformOptions } from '../types/TransformOptions';
import { ChainNetwork } from '../types/ChainNetwork';
import { TransformableModel } from '../types/TransformableModel';
import logger from '../logger';
import { LoggifyObject } from '../decorators/Loggify';
import { Bitcoin } from '../types/namespaces/Bitcoin';

export interface IBlock {
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
}

export type BlockQuery = { [key in keyof IBlock]?: any } &
  Partial<DocumentQuery<IBlock, Document>>;
type IBlockDoc = IBlock & Document;

export type AddBlockParams = {
  block: Bitcoin.Block;
  parentChain?: string;
  forkHeight?: number;
} & ChainNetwork &
  Partial<IBlock>;

type IBlockModelDoc = IBlockDoc & TransformableModel<IBlockDoc>;
export type BlockMethodParams = { header?: Bitcoin.Block.HeaderObj } & ChainNetwork;
export interface IBlockModel extends IBlockModelDoc {
  addBlock: (params: AddBlockParams) => Promise<IBlockModel>;
  handleReorg: (params: BlockMethodParams) => Promise<void>;
  getLocalTip: (params: BlockMethodParams) => Promise<IBlockModel>;
  getPoolInfo: (coinbase: string) => string;
  getLocatorHashes: (params: ChainNetwork) => Promise<string[]>;
}

const BlockSchema = new Schema({
  chain: String,
  network: String,
  height: Number,
  hash: String,
  version: Number,
  merkleRoot: String,
  time: Date,
  timeNormalized: Date,
  nonce: Number,
  previousBlockHash: String,
  nextBlockHash: String,
  transactionCount: Number,
  size: Number,
  bits: Number,
  reward: Number,
  processed: Boolean
});

BlockSchema.index({ hash: 1 });
BlockSchema.index({ chain: 1, network: 1, processed: 1, height: -1 });
BlockSchema.index({ chain: 1, network: 1, timeNormalized: 1 });
BlockSchema.index({ previousBlockHash: 1 });

BlockSchema.statics.addBlock = async (params: AddBlockParams) => {
  const { block, chain, network, parentChain, forkHeight } = params;
  const header = block.header.toObject();
  const blockTime = header.time * 1000;

  await BlockModel.handleReorg({ header, chain, network });

  const previousBlock = await BlockModel.findOne({
    hash: header.prevHash,
    chain,
    network
  });

  const blockTimeNormalized = (() => {
    if (previousBlock && blockTime <= previousBlock.timeNormalized.getTime()) {
      return previousBlock.timeNormalized.getTime() + 1;
    } else {
      return blockTime;
    }
  })();

  const height = (previousBlock && previousBlock.height + 1) || 1;
  logger.debug('Setting blockheight', height);

  await BlockModel.update(
    {
      hash: header.hash,
      chain,
      network
    },
    {
      chain,
      network,
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
    },
    {
      upsert: true
    }
  );

  if (previousBlock) {
    previousBlock.nextBlockHash = header.hash;
    logger.debug('Updating previous block.nextBlockHash ', header.hash);
    await previousBlock.save();
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
    forkHeight
  });

  return BlockModel.update(
    { hash: header.hash, chain, network },
    { $set: { processed: true } }
  );
};

BlockSchema.statics.getPoolInfo = function(coinbase: string) {
  //TODO need to make this actually parse the coinbase input and map to miner strings
  // also should go somewhere else
  return coinbase;
};

BlockSchema.statics.getLocalTip = async (params: ChainNetwork) => {
  const { chain, network } = params;
  const bestBlock = await BlockModel.findOne({
    processed: true,
    chain,
    network
  }).sort({ height: -1 });
  return bestBlock || { height: 0 };
};

BlockSchema.statics.getLocatorHashes = async (params: ChainNetwork) => {
  const { chain, network } = params;
  const locatorBlocks = await BlockModel.find({
    processed: true,
    chain,
    network
  })
    .sort({ height: -1 })
    .limit(30)
    .exec();

  if (locatorBlocks.length < 2) {
    return [Array(65).join('0')];
  }
  return locatorBlocks.map(block => block.hash);
};

BlockSchema.statics.handleReorg = async (params: BlockMethodParams) => {
  const { header, chain, network } = params;
  const localTip = await BlockModel.getLocalTip(params);
  if (header && localTip.hash === header.prevHash) {
    return;
  }
  if (localTip.height === 0) {
    return;
  }
  logger.info(`Resetting tip to ${localTip.previousBlockHash}`, {
    chain,
    network
  });

  await BlockModel.remove({
    chain,
    network,
    height: {
      $gte: localTip.height
    }
  });
  await TransactionModel.remove({
    chain,
    network,
    blockHeight: {
      $gte: localTip.height
    }
  });
  await CoinModel.remove({
    chain,
    network,
    mintHeight: {
      $gte: localTip.height
    }
  });
  await CoinModel.update(
    {
      chain,
      network,
      spentHeight: {
        $gte: localTip.height
      }
    },
    {
      $set: { spentTxid: null, spentHeight: -1 }
    },
    {
      multi: true
    }
  );

  logger.debug('Removed data from above blockHeight: ', localTip.height);
};

BlockSchema.statics._apiTransform = function(
  block: IBlockModel,
  options: TransformOptions
) {
  let transform = {
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
};

LoggifyObject(BlockSchema.statics, 'BlockSchema');
export let BlockModel: IBlockModel = model<IBlockDoc, IBlockModel>(
  'Block',
  BlockSchema
);
