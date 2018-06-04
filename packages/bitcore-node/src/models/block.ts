import logger from '../logger';
import { Schema, Document, model, DocumentQuery } from 'mongoose';
import { CoinModel } from './coin';
import { TransactionModel } from './transaction';
import { TransformOptions } from '../types/TransformOptions';
import { ChainNetwork } from '../types/ChainNetwork';
import { TransformableModel } from '../types/TransformableModel';
import { LoggifyObject } from '../decorators/Loggify';
import { CoreBlock } from '../types/namespaces/ChainAdapter';
import { partition } from '../utils/partition';

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

type IBlockModelDoc = IBlockDoc & TransformableModel<IBlockDoc>;
export interface IBlockModel extends IBlockModelDoc {
  addBlocks: (blocks: CoreBlock[]) => Promise<string[]>;
  handleReorg: (prevHash: string, chainnet: ChainNetwork) => Promise<void>;
  getLocalTip: (chainnet: ChainNetwork) => Promise<IBlockModel>;
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

const batch = (items, n, f) => Promise.all(partition(items, n).map(f));

BlockSchema.statics.addBlocks = async (blocks: CoreBlock[]) => {
  const first = blocks[0];
  if (!first) {
    return;
  }
  const { chain, network } = first;

  await BlockModel.handleReorg(first.header.prevHash, { chain, network });

  const startBlock = await BlockModel.findOne({
    hash: first.header.prevHash,
    chain,
    network
  });
  if (startBlock) {
    startBlock.nextBlockHash = first.header.hash;
    logger.debug('Updating previous block.nextBlockHash ', first.header.hash);
    await startBlock.save();
  }

  // Calculate all the normalized times for every block (needs to be sequential)
  const normalizedTimes: number[] = blocks.reduce((times, block, i) => {
    if (block.header.time <= times[i]) {
      return times.concat(times[i] + 1);
    }
    return times.concat(block.header.time);
  }, [startBlock? startBlock.timeNormalized.getTime() : 0]).slice(1);

  // Calculate block heights
  const height = i => ((startBlock && startBlock.height + 1) || 1) + i;

  const hashes = await Promise.all(blocks.map(async (block, i) => {
    await Promise.all([
      // Add the block
      BlockModel.update({
        hash: block.header.hash,
        chain,
        network
      }, {
        chain,
        network,
        height: height(i),
        version: block.header.version,
        previousBlockHash: block.header.prevHash,
        merkleRoot: block.header.merkleRoot,
        time: new Date(block.header.time),
        timeNormalized: new Date(normalizedTimes[i]),
        bits: block.header.bits,
        nonce: block.header.nonce,
        transactionCount: block.transactions.length,
        size: block.size,
        reward: block.reward,
        nextBlockHash: blocks[i + 1] && blocks[i + 1].header.hash,
      }, {
        upsert: true
      }),
      // Get the minted coins from the block
      (async () => {
        const mintOps = await TransactionModel.getMintOps(block.transactions, height(i));
        logger.debug('Minting Coins', mintOps.length);
        await batch(mintOps, 100, b => CoinModel.collection.bulkWrite(b, {
          ordered: false
        }));
      })(),
    ]);

    return block.header.hash;
  }));

  // Calculate Spending (unfortunately this must be done in order)
  for (const [i, block] of blocks.entries()) {
    const spendOps = TransactionModel.getSpendOps(block.transactions, height(i));
    logger.debug('Spending Coins', spendOps.length);
    await batch(spendOps, 100, b => CoinModel.collection.bulkWrite(b, {
      ordered: false
    }));
  }

  // Add transactions
  await Promise.all(blocks.map(async (block, i) => {
    const txOps = await TransactionModel.addTransactions(block.transactions, {
      blockHash: block.header.hash,
      blockTime: block.header.time,
      blockTimeNormalized: normalizedTimes[i],
      height: height(i),
    });
    logger.debug('Writing Transactions', txOps.length);
    await batch(txOps, 100, b => TransactionModel.collection.bulkWrite(b, {
      ordered: false
    }));
  }));

  // Mark these blocks as 'processed'
  await Promise.all(blocks.map(block => BlockModel.update({
    hash: block.header.hash,
    chain,
    network
  }, {
    $set: {
      processed: true
    }
  })));

  return hashes;
};

BlockSchema.statics.getPoolInfo = function(coinbase: string) {
  //TODO need to make this actually parse the coinbase input and map to miner strings
  // also should go somewhere else
  return coinbase;
};

BlockSchema.statics.getLocalTip = async ({ chain, network }: ChainNetwork) => {
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

BlockSchema.statics.handleReorg = async (prevHash: string, { chain, network }: ChainNetwork) => {
  const localTip = await BlockModel.getLocalTip({ chain, network });
  if (localTip.hash === prevHash) {
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
