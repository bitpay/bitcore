'use strict';
var Block;
var bcoin = require('bcoin');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var async = require('async');

var config = require('../config');
var Transaction = mongoose.model('Transaction');
var workerService = require('../services/worker');

var BlockSchema = new Schema({
  network: String,
  mainChain: Boolean,
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

BlockSchema.index({hash: 1}, {unique: true});
BlockSchema.index({height: 1});
BlockSchema.index({time: 1});
BlockSchema.index({timeNormalized: 1});
BlockSchema.index({mainChain: 1});
BlockSchema.index({previousBlockHash: 1, mainChain: 1});

BlockSchema.statics.addBlock = function(block, callback){
  var blockTime = block.ts * 1000;
  var blockTimeNormalized;
  var height;
  async.series([
    function(cb){
      Block.findOne({
        mainChain: true,
        previousBlockHash: bcoin.util.revHex(block.prevBlock)
      }, function(err, existingBlock){
        if(err){
          return cb(err);
        }
        if(!existingBlock || existingBlock.hash === block.rhash()){
          return cb(null);
        }
        console.log('REORG: ' + existingBlock.hash);

        Block.update({mainChain: true, height: {$gte: existingBlock.height}},
          {$set: {mainChain: false}}, {multi: true}, function(err) {
            if(err){
              return cb(err);
            }
            Transaction.update({blockHash: existingBlock.hash},
            {$set: {mainChain: false}}, {multi:true}, function(err){
              if(err) {
                return cb(err);
              }
              cb(null);
            });
          });
      });
    },
    function(cb){
      Block.findOne({hash: bcoin.util.revHex(block.prevBlock)}, function(err, previousBlock) {
        if(err) {
          return cb(err);
        }
        if(!previousBlock && block.prevBlock !== bcoin.network.get(config.network).genesis.hash){
          return cb(new Error('No previous block found'));
        }
        blockTimeNormalized = blockTime;
        if(previousBlock && blockTime <= previousBlock.timeNormalized.getTime()) {
          blockTimeNormalized = previousBlock.timeNormalized.getTime() + 1;
        }
        height = (previousBlock && previousBlock.height + 1) || 1;
        Block.update({hash: block.rhash()}, {
          network: config.network,
          mainChain: true,
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
    function(cb){
      async.eachLimit(block.txs, workerService.workerCount(), function(transaction, txCb) {
        workerService.sendTask('syncTransactionAndOutputs', {
          transaction: JSON.stringify(transaction.toJSON()),
          blockHeight: height,
          blockHash: block.rhash(),
          blockTime: blockTime,
          blockTimeNormalized: blockTimeNormalized,
          mainChain: true,
          mempool: false
        }, txCb);
      }, cb);
    },
    function(cb) {
      async.eachLimit(block.txs, workerService.workerCount(), function(transaction, txCb) {
        workerService.sendTask('syncTransactionInputs', transaction.rhash(), txCb);
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

BlockSchema.statics._apiTransform = function(block){
  var transform = {
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
  return JSON.stringify(transform);
};

module.exports = Block = mongoose.model('Block', BlockSchema);