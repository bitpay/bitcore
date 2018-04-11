const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const async = require('async');

const logger = require('../logger');
const Transaction = mongoose.model('Transaction');
const Coin = mongoose.model('Coin');

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

BlockSchema.statics.addBlock = function(params, callback){
  let {block, chain, network, parentChain, forkHeight} = params;
  let header = block.header.toObject();
  let blockTime = header.time * 1000;
  let blockTimeNormalized;
  let height;
  async.series([
    function(cb){
      Block.handleReorg({header, chain, network}, cb);
    },
    function(cb){
        Block.findOne({ hash: header.prevHash, chain, network}, function(err, previousBlock) {
        if(err) {
          return cb(err);
        }
        blockTimeNormalized = blockTime;
        if(previousBlock && blockTime <= previousBlock.timeNormalized.getTime()) {
          blockTimeNormalized = previousBlock.timeNormalized.getTime() + 1;
        }
        height = (previousBlock && previousBlock.height + 1) || 1;
        Block.update({hash: header.hash, chain, network}, {
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
        }, {upsert: true}, function(err){
          if (err){
            return cb(err);
          }
          if (!previousBlock){
            return cb();
          }
          previousBlock.nextBlockHash = header.hash;
          previousBlock.save(cb);
        });
      });
    },
    async () => {
      return Transaction.batchImport({
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
    }
  ], function(err){
    if(err){
      return callback(err);
    }
    Block.update({hash: header.hash, chain, network}, {$set: {processed:true}}, callback);
  });
};

BlockSchema.statics.getPoolInfo = function(coinbase){
  //TODO need to make this actually parse the coinbase input and map to miner strings
  // also should go somewhere else
  return 'miningPool';
};

BlockSchema.statics.getLocalTip = function(params) {
  return new Promise(async (resolve, reject) => {
    const { chain, network } = params;
    try {
      let bestBlock = await Block.findOne({ processed: true, chain, network }).sort({ height: -1 }).exec();
      bestBlock = bestBlock || { height: 0 };
      resolve(bestBlock);
    } catch (e){
      reject(e);
    }
  });
};

BlockSchema.statics.getLocatorHashes = function(params, callback) {
  const { chain, network } = params;
  Block.find({processed: true, chain, network}).sort({height: -1}).limit(30).exec(function(err, locatorBlocks) {
    if(err) {
      return callback(err);
    }
    if(locatorBlocks.length < 2) {
      return callback(null, [Array(65).join('0')]);
    }
    locatorBlocks = locatorBlocks.map((block) => block.hash);
    callback(null, locatorBlocks);
  });
};

BlockSchema.statics.handleReorg = async function(params, callback) {
  const { header, chain, network } = params;
  let localTip = await Block.getLocalTip(params);
  if (header && localTip.hash === header.prevHash) {
    return callback();
  }
  if (localTip.height === 0) {
    return callback();
  }
  logger.info(`Resetting tip to ${localTip.previousBlockHash}`, { chain, network });
  async.series([
    function (cb) {
      Block.remove({ chain, network, height: { $gte: localTip.height } }, cb);
    },
    function (cb) {
      Transaction.remove({ chain, network, blockHeight: { $gte: localTip.height } }, cb);
    },
    function (cb) {
      Coin.remove({ chain, network, mintHeight: { $gte: localTip.height } }, cb);
    },
    function (cb) {
      Coin.update({ chain, network, spentHeight: { $gte: localTip.height } }, {
        $set: { spentTxid: null, spentHeight: -1 }
      }, { multi: true }, cb);
    }
  ], callback);
};


BlockSchema.statics._apiTransform = function(block, options){
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
    difficulty: block.difficulty,
    chainWork: block.chainWork,
    previousBlockHash: block.previousBlockHash,
    nextBlockHash: block.nextBlockHash,
    reward: block.reward,
    isMainChain: block.mainChain,
    transactionCount: block.transactionCount,
    minedBy: Block.getPoolInfo(block.minedBy)
  };
  if(options && options.object){
    return transform;
  }
  return JSON.stringify(transform);
};

var Block = module.exports = mongoose.model('Block', BlockSchema);
