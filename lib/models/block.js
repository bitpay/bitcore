const bcoin = require('bcoin');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const async = require('async');
const _ = require('underscore');

const config = require('../config');
const Transaction = mongoose.model('Transaction');
const Coin = mongoose.model('Coin');

const BlockSchema = new Schema({
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

BlockSchema.index({hash: 1});
BlockSchema.index({height: 1});
BlockSchema.index({timeNormalized: 1});
BlockSchema.index({previousBlockHash: 1});

BlockSchema.statics.addBlock = function(block, callback){
  let blockTime = block.ts * 1000;
  let blockTimeNormalized;
  let height;
  async.series([
    function(cb){
      Block.handleReorg(block, cb);
    },
    function(cb){
      Block.findOne({hash: bcoin.util.revHex(block.prevBlock)}, function(err, previousBlock) {
        if(err) {
          return cb(err);
        }
        if(!previousBlock &&
          block.prevBlock !== bcoin.network.get(config.network).genesis.hash &&
          block.prevBlock !== '0000000000000000000000000000000000000000000000000000000000000000'){
          return cb(new Error('No previous block found'));
        }
        blockTimeNormalized = blockTime;
        if(previousBlock && blockTime <= previousBlock.timeNormalized.getTime()) {
          blockTimeNormalized = previousBlock.timeNormalized.getTime() + 1;
        }
        height = (previousBlock && previousBlock.height + 1) || 1;
        Block.update({hash: block.rhash()}, {
          network: config.network,
          height: height,
          version: block.version,
          previousBlockHash: bcoin.util.revHex(block.prevBlock),
          merkleRoot: block.merkleRoot,
          time: new Date(blockTime),
          timeNormalized: new Date(blockTimeNormalized),
          bits: block.bits,
          nonce: block.nonce,
          transactionCount: block.txs.length,
          size: block._size,
          reward: bcoin.consensus.getReward(height, bcoin.network.get(config.network).halvingInterval)
        }, {upsert: true}, function(err){
          if (err){
            return cb(err);
          }
          if (!previousBlock){
            return cb();
          }
          previousBlock.nextBlockHash = block.rhash();
          previousBlock.save(cb);
        });
      });
    },
    function (cb) {
      async.eachLimit(block.txs, config.maxPoolSize, function (tx, txCb) {
        Transaction.mintCoins({
          transaction: tx,
          network: config.network,
          mintHeight: height
        }, txCb);
      }, cb);
    },
    function (cb) {
      async.eachLimit(block.txs, config.maxPoolSize, function (tx, txCb) {
        Transaction.spendCoins({
          transaction: tx,
          spentHeight: height
        }, txCb);
      }, cb);
    },
    function (cb) {
      async.eachLimit(block.txs, config.maxPoolSize, function (tx, txCb) {
        Transaction.addTransaction({
          transaction: tx,
          network: config.network,
          blockHeight: height,
          blockTime: blockTime,
          blockTimeNormalized: blockTimeNormalized
        }, txCb);
      }, cb);
    }
  ], function(err){
    if(err){
      return callback(err);
    }
    Block.update({hash: block.rhash()}, {$set: {processed:true}}, callback);
  });
};

BlockSchema.statics.getPoolInfo = function(coinbase){
  //TODO need to make this actually parse the coinbase input and map to miner strings
  // also should go somewhere else
  return 'miningPool';
};

BlockSchema.statics.getLocalTip = function(callback) {
  Block.find({processed: true, network: config.network}).sort({height: -1}).limit(1).exec(function(err, bestBlock) {
    if(err) {
      return callback(err);
    }
    bestBlock = bestBlock[0] || {height: 0};
    callback(null, bestBlock);
  });
};

BlockSchema.statics.getLocatorHashes = function(callback) {
  Block.find({processed: true, network: config.network}).sort({height: -1}).limit(30).exec(function(err, locatorBlocks) {
    if(err) {
      return callback(err);
    }
    if(locatorBlocks.length < 2) {
      return callback(null, [Array(65).join('0')]);
    }
    locatorBlocks = _.pluck(locatorBlocks, 'hash');
    callback(null, locatorBlocks);
  });
};

BlockSchema.statics.handleReorg = function(block, callback) {
  Block.getLocalTip(function(err, localTip) {
    if(err) {
      return callback(err);
    }
    if(block && localTip.hash === bcoin.util.revHex(block.prevBlock)) {
      return callback();
    }
    if(localTip.height === 0){
      return callback();
    }
    console.log(`Resetting tip to ${localTip.previousBlockHash}`);
    async.series([
      function(cb){
        Block.remove({ network: config.network, height: { $gte: localTip.height } }, cb);
      },
      function(cb){
        Transaction.remove({ network: config.network, blockHeight: { $gte: localTip.height } }, cb);
      },
      function(cb){
        Coin.remove({ network: config.network, mintHeight: { $gte: localTip.height } }, cb);
      },
      function (cb) {
        Coin.update({ network: config.network, spentHeight: { $gte: localTip.height } }, {
          $set: {spentTxid: null, spentHeight: -1}
        }, { multi: true }, cb);
      }
    ], callback);
  });
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
    minedBy: Block.getPoolInfo(block.minedBy)
  };
  if(options && options.object){
    return transform;
  }
  return JSON.stringify(transform);
};

var Block = module.exports = mongoose.model('Block', BlockSchema);