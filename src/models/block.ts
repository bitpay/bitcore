import { Schema, Document, model, DocumentQuery } from 'mongoose';
import { CoinModel } from './coin';
import { TransactionModel } from './transaction';
import { CallbackType } from '../types/Callback';
import { TransformOptions } from '../types/TransformOptions';
import { BitcoinBlockType, BlockHeaderObj } from '../types/Block';
import { ChainNetwork } from '../types/ChainNetwork';
import { TransformableModel } from '../types/TransformableModel';
import logger from '../logger';
import { LoggifyObject } from '../decorators/Loggify';
const async = require('async');

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
  block: BitcoinBlockType;
  parentChain: string;
  forkHeight: number;
} & ChainNetwork &
  Partial<IBlock>;

type IBlockModelDoc = IBlockDoc & TransformableModel<IBlockDoc>;
type BlockMethodParams = { header?: BlockHeaderObj } & ChainNetwork;
interface IBlockModel extends IBlockModelDoc {
  addBlock: (params: AddBlockParams, callback: CallbackType) => any;
  handleReorg: (params: BlockMethodParams, cb: CallbackType) => any;
  getLocalTip: (params: BlockMethodParams) => IBlockModel;
  getPoolInfo: (coinbase: string) => string;
  getLocatorHashes: (params: ChainNetwork, callback: CallbackType) => any;
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

BlockSchema.statics.addBlock = function(
  params: AddBlockParams,
  callback: CallbackType
) {
  let { block, chain, network, parentChain, forkHeight } = params;
  let header = block.header.toObject();
  let blockTime = header.time * 1000;
  let blockTimeNormalized: number;
  let height: number;
  async.series(
    [
      function(cb: CallbackType) {
        BlockModel.handleReorg({ header, chain, network }, cb);
      },
      function(cb: CallbackType) {
        BlockModel.findOne({ hash: header.prevHash, chain, network }, function(
          err: any,
          previousBlock: IBlockDoc
        ) {
          if (err) {
            logger.error(err);
            return cb(err);
          }
          blockTimeNormalized = blockTime;
          if (
            previousBlock &&
            blockTime <= previousBlock.timeNormalized.getTime()
          ) {
            blockTimeNormalized = previousBlock.timeNormalized.getTime() + 1;
          }
          height = (previousBlock && previousBlock.height + 1) || 1;
          logger.debug('Setting blockheight', height);
          BlockModel.update(
            { hash: header.hash, chain, network },
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
            { upsert: true },
            function(err: any) {
              if (err) {
                return cb(err);
              }
              if (!previousBlock) {
                return cb();
              }
              previousBlock.nextBlockHash = header.hash;
              logger.debug(
                'Updating previous block.nextBlockHash ',
                header.hash
              );
              previousBlock.save(cb);
            }
          );
        });
      },
      function(cb: CallbackType) {
        TransactionModel.batchImport({
          txs: block.transactions,
          blockHash: header.hash,
          blockTime: new Date(blockTime),
          blockTimeNormalized: new Date(blockTimeNormalized),
          height: height,
          chain,
          network,
          parentChain,
          forkHeight
        }).then(cb);
      }
    ],
    function(err: any) {
      if (err) {
        return callback(err);
      }
      BlockModel.update(
        { hash: header.hash, chain, network },
        { $set: { processed: true } },
        callback
      );
    }
  );
};

BlockSchema.statics.getPoolInfo = function(coinbase: string) {
  //TODO need to make this actually parse the coinbase input and map to miner strings
  // also should go somewhere else
  return coinbase;
};

BlockSchema.statics.getLocalTip = function(params: ChainNetwork) {
  return new Promise(async (resolve, reject) => {
    const { chain, network } = params;
    try {
      let bestBlock = await BlockModel.findOne({
        processed: true,
        chain,
        network
      })
        .sort({ height: -1 })
        .exec();
      let foundBlock = bestBlock || { height: 0 };
      resolve(foundBlock);
    } catch (e) {
      reject(e);
    }
  });
};

BlockSchema.statics.getLocatorHashes = function(
  params: ChainNetwork,
  callback: CallbackType
) {
  const { chain, network } = params;
  BlockModel.find({ processed: true, chain, network })
    .sort({ height: -1 })
    .limit(30)
    .exec(function(err, locatorBlocks) {
      if (err) {
        return callback(err);
      }
      if (locatorBlocks.length < 2) {
        return callback(null, [Array(65).join('0')]);
      }
      let hashArr = locatorBlocks.map(block => block.hash);
      callback(null, hashArr);
    });
};

BlockSchema.statics.handleReorg = async function(
  params: BlockMethodParams,
  callback: CallbackType
) {
  const { header, chain, network } = params;
  let localTip = await BlockModel.getLocalTip(params);
  if (header && localTip.hash === header.prevHash) {
    return callback();
  }
  if (localTip.height === 0) {
    return callback();
  }
  logger.info(`Resetting tip to ${localTip.previousBlockHash}`, {
    chain,
    network
  });
  async.series(
    [
      function(cb: CallbackType) {
        BlockModel.remove(
          { chain, network, height: { $gte: localTip.height } },
          cb
        );
      },
      function(cb: CallbackType) {
        TransactionModel.remove(
          { chain, network, blockHeight: { $gte: localTip.height } },
          cb
        );
      },
      function(cb: CallbackType) {
        CoinModel.remove(
          { chain, network, mintHeight: { $gte: localTip.height } },
          cb
        );
      },
      function(cb: CallbackType) {
        CoinModel.update(
          { chain, network, spentHeight: { $gte: localTip.height } },
          {
            $set: { spentTxid: null, spentHeight: -1 }
          },
          { multi: true },
          cb
        );
      },
      function(cb: CallbackType) {
        logger.debug('Removed data from above blockHeight: ', localTip.height);
        cb();
      }
    ],
    callback
  );
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
