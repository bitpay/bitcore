import logger from '../logger';
import { Schema, Document, model, DocumentQuery } from 'mongoose';
import { CoinModel } from './coin';
import { TransactionModel } from './transaction';
import { TransformOptions } from '../types/TransformOptions';
import { ChainNetwork } from '../types/ChainNetwork';
import { TransformableModel } from '../types/TransformableModel';
import { LoggifyObject } from '../decorators/Loggify';
import { CoreBlock } from '../types/namespaces/ChainAdapter';
// import { partition } from '../utils/partition';

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
  bits: string;
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
  bits: String,
  reward: Number,
  processed: Boolean
});

BlockSchema.index({ hash: 1 }, { unique: true });
BlockSchema.index({ chain: 1, network: 1, processed: 1, height: -1 });
BlockSchema.index({ chain: 1, network: 1, timeNormalized: 1 });
// BlockSchema.index({ previousBlockHash: 1 });

export function batch<T, M>(items: T[], f: (items: T[]) => Promise<M>, n: number = 100): Promise<M[]> {
  const partitioned: {
    curr: T[];
    accum: T[][];
  } = {
    curr: [],
    accum: [],
  };

  for (const [i, item] of items.entries()) {
    partitioned.curr.push(item);
    if (i % n === 0) {
      partitioned.accum.push(partitioned.curr);
      partitioned.curr = [];
    }
  }
  partitioned.accum.push(partitioned.curr);

  return Promise.all(partitioned.accum.map(f));
}

async function time<T>(store: {
  [key: string]: number;
}, title: string, f: () => PromiseLike<T>): Promise<T> {
  const start = Date.now();
  const result = await f();
  const end = Date.now();
  store[title] = end - start;
  return result;
};

BlockSchema.statics.addBlocks = async (blocks: CoreBlock[]) => {
  const timings = {};
  const start = Date.now();
  const first = blocks[0];
  if (!first) {
    return;
  }
  const { chain, network } = first;

  await BlockModel.handleReorg(first.header.prevHash, { chain, network });

  const startBlock = await time(timings, 'find_start_block', async () => {
    return await BlockModel.findOne({ hash: first.header.prevHash })
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

  // Mine all the blocks
  const mine = time(timings, `bulkwrite_blocks`, async () => {
    return await BlockModel.collection.bulkWrite(blocks.map((block, i) => {
      return {
        insertOne: {
          document: {
            chain,
            network,
            hash: block.header.hash,
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
          },
        },
      };
    }), {
      ordered: false,
    }).then(_ => {});
  });

  // Mint & Spend: Merge Strategy
  const txs = blocks.map((block, i) => {
    return {
      height: height(i),
      txs: block.transactions,
    };
  });
  const mint = await TransactionModel.getMintOps(txs);
  const spend = TransactionModel.getSpendOps(txs);

  const memo = mint.reduce((prev, curr) => {
    const doc = curr.updateOne.update.$set;
    if (!prev[doc.mintTxid]) {
      prev[doc.mintTxid] = {};
    }
    prev[doc.mintTxid][doc.mintIndex] = curr;
    return prev;
  }, {});

  const merged_spend = spend.filter(op => {
    const filter = op.updateOne.filter;
    if (memo[filter.mintTxid] && memo[filter.mintTxid][filter.mintIndex]) {
      const mintop = memo[filter.mintTxid][filter.mintIndex];
      mintop.updateOne.update.$set.spentTxid = op.updateOne.update.$set.spentTxid;
      mintop.updateOne.update.$set.spentHeight = op.updateOne.update.$set.spentHeight;
      return false;
    }
    return true;
  });

  const bulk_mint = time(timings, `bulkwrite_mint`, async () => {
    await CoinModel.collection.bulkWrite(mint, {
      ordered: false,
    });
  });

  const bulk_spend = time(timings, `bulkwrite_spend`, async () => {
    if (merged_spend.length > 0) {
      await CoinModel.collection.bulkWrite(merged_spend, {
        ordered: false,
      });
    }
  });

  await time(timings, 'all_mine_mint_spend', async () => {
    return await Promise.all([
      mine,
    ].concat(bulk_mint).concat(bulk_spend));
  });

  // Add transactions
  await Promise.all(blocks.map(async (block, i) => {
    const ops = await time(timings, `add_transactions_${i}`, async () => {
      return await TransactionModel.addTransactions(block.transactions, {
        blockHash: block.header.hash,
        blockTime: block.header.time,
        blockTimeNormalized: normalizedTimes[i],
        height: height(i),
      });
    });
    return await time(timings, `bulkwrite_transactions_${i}`, async () => {
      return await TransactionModel.collection.bulkWrite(ops, {
        ordered: false
      });
    });
  }));

  // Mark unspent coins with spent height -2
  await time(timings, 'unspent_coins', async () => {
    await CoinModel.update({
      spentHeight: null,
    }, {
      $set: {
        spentHeight: -2,
      }
    })
  });

  // Mark these blocks as 'processed'
  await time(timings, 'blocks_mark_processed', async () => {
    await Promise.all(blocks.map(block => BlockModel.update({
      hash: block.header.hash,
    }, {
      $set: {
        processed: true
      }
    })));
  });

  const end = Date.now();
  logger.info(`Avg. ms/Block: ${(end - start) / blocks.length}`);
  const size = blocks.map(b => b.size).reduce((a, b) => a + b);
  logger.info(`Avg. Bytes/ms: ${ size / (end - start) }`);
  console.log(`Profiling: ${startBlock? startBlock.height : 0} ${JSON.stringify(timings)}`);
  return blocks.map(b => b.header.hash);
};

BlockSchema.statics.getPoolInfo = function(coinbase: string) {
  //TODO need to make this actually parse the coinbase input and map to miner strings
  // also should go somewhere else
  return coinbase;
};

// TODO: create a memo for local tip
BlockSchema.statics.getLocalTip = async ({ // chain, network
}: ChainNetwork) => {
  const bestBlock = await BlockModel.findOne({
    // TODO: BlockModel.getLocalTip uses BlockModel.processed key
    processed: true,
    // chain,
    // network
  }).sort({ height: -1 });
  return bestBlock || { height: 0 };
};

// TODO: create a ring buffer for locator hashes
BlockSchema.statics.getLocatorHashes = async (// params: ChainNetwork
) => {
  // const { chain, network } = params;
  const locatorBlocks = await BlockModel.find({
    // TODO: BlockModel.locatorBlocks uses BlockModel.processed key
    processed: true,
    // chain,
    // network
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
    // chain,
    // network,
    height: {
      $gte: localTip.height
    }
  });
  // TODO: handleReorg uses TransactionModel.blockHeight index
  await TransactionModel.remove({
    // chain,
    // network,
    blockHeight: {
      $gte: localTip.height
    }
  });
  await CoinModel.remove({
    // chain,
    // network,
    // TODO: Reorg uses CoinModel.mintHeight index
    mintHeight: {
      $gte: localTip.height
    }
  });
  await CoinModel.update(
    {
      // chain,
      // network,
      // TODO: Reorg uses CoinModel.spentHeight index
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
