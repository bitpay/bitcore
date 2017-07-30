'use strict';
var Block;
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var async = require('async');
var bitcore = require('bitcore-lib');

var workerService = require('../services/worker');

var BlockSchema = new Schema({
  mainChain: Boolean,
  height: Number,
  hash: String,
  version: Number,
  merkleRoot: String,
  time: Date,
  timeNormalized: Date,
  nonce: Number,
  previousBlockHash: String,
  transactionCount: Number
});

BlockSchema.index({hash: 1}, {unique: true});
BlockSchema.index({height: 1});
BlockSchema.index({time: 1});
BlockSchema.index({timeNormalized: 1});

BlockSchema.statics.processBlock = function(block, height, callback) {
  block = new bitcore.Block.fromString(block);
  var blockTime = block.header.time * 1000;
  var blockTimeNormalized;
  console.log('Block Time:\t\t' + new Date(block.header.timestamp * 1000));
  console.log('tx count:\t\t' + block.transactions.length);
  async.series([
    function(cb) {
      Block.findOne({hash: block.header.prevHash}, function(err, previousBlock) {
        if(err) {
          return cb(err);
        }
        blockTimeNormalized = blockTime;
        if(previousBlock && blockTime <= previousBlock.timeNormalized.getTime()) {
          blockTimeNormalized = previousBlock.blockTimeNormalized.getTime() + 1;
        }
        Block.update({hash: block.hash}, {
          mainChain: true,
          height: height,
          version: block.header.version,
          previousBlockHash: block.header.prevHash,
          merkleRoot: block.header.merkleRoot,
          time: new Date(blockTime),
          timeNormalized: new Date(blockTimeNormalized),
          bits: block.header.bits,
          nonce: block.header.nonce,
          transactionCount: block.transactions.length
        }, {upsert: true}, cb);
      });
    },
    function(cb) {
      async.eachLimit(block.transactions, workerService.workerCount(), function(transaction, txCb) {
        workerService.sendTask('syncTransactionAndOutputs', {
          transaction: transaction,
          blockHeight: height,
          blockHash: block.hash,
          blockTime: blockTime,
          blockTimeNormalized: blockTimeNormalized
        }, txCb);
      }, cb);
    },
    function(cb) {
      async.eachLimit(block.transactions, workerService.workerCount(), function(transaction, txCb) {
        workerService.sendTask('syncTransactionInputs', transaction.hash, txCb);
      }, cb);
    }
  ], function(err) {
    callback(err);
  });
};

module.exports = Block = mongoose.model('Block', BlockSchema);