'use strict';
var cluster = require('cluster');
var async = require('async');
var _ = require('underscore');
var mongoose = require('mongoose');
var bcoin = require('bcoin');

var Block = mongoose.model('Block');
var Transaction = mongoose.model('Transaction');
var p2p = require('./p2p');

var SyncService = function(){
  this.headersQueue = [];
};

SyncService.prototype.sync = function(done) {
  var self = this;
  done = done || function(){};
  async.during(
    function(cb){
      self.getHeaders(function(err, headers){
        self.headersQueue = headers;
        cb(err, headers.length);
      });
    },
    function(cb){
      async.eachSeries(self.headersQueue, function(header, cb){
        var start = Date.now();
        p2p.getBlock(header._hhash, function(err, block){
          console.log('===============================================================');
          console.log('Block Time:\t\t' + new Date(block.ts*1000));
          console.log('tx count:\t\t' + block.txs.length);
          Block.addBlock(block, function(err){
            var end = Date.now();
            console.log('tx/s :\t\t\t' + (block.txs.length / (end - start) * 1000).toFixed(2));
            cb(err);
          });
        });
      }, function(err){
        cb(err);
      });
    },
    function(err){

    }
  );
};

SyncService.prototype.start = function(ready){
  var self = this;
  if(cluster.isMaster) {
    self.sync();
  } else {
    process.on('message', function(payload) {
      if(payload.task === 'syncTransactionAndOutputs') {
        Transaction.syncTransactionAndOutputs(payload.argument, function(err) {
          process.send({error: err});
        });
      }
      if(payload.task === 'syncTransactionInputs') {
        Transaction.syncTransactionInputs(payload.argument, function(err) {
          process.send({error: err});
        });
      }
    });
  }
  setImmediate(ready);
};

SyncService.prototype.stop = function(){

};

SyncService.prototype.getLocalTip = function(callback) {
  Block.find({mainChain:true, processed: true}).sort({height:-1}).limit(1).exec(function(err, bestBlock){
    if(err){
      return callback(err);
    }
    bestBlock = bestBlock.length && bestBlock[0];
    if(!bestBlock){
      return bcoin.network.get('main').genesis;
    }
    callback(null, bestBlock);
  });
};

SyncService.prototype.getLocatorHashes = function(callback) {
  Block.find({mainChain: true, processed: true}).sort({height: -1}).limit(31).exec(function(err, locatorBlocks) {
    if(err) {
      return callback(err);
    }
    if(locatorBlocks.length < 2) {
      return callback(null, [bcoin.network.get('main').genesis.hash]);
    }
    locatorBlocks = _.pluck(locatorBlocks, 'hash');
    locatorBlocks.shift();
    callback(null, locatorBlocks);
  });
};

SyncService.prototype.getHeaders = function(callback) {
  var self = this;
  self.getLocatorHashes(function(err, locatorHashes){
    if(err) {
      return callback(err);
    }
    p2p.getHeaders(locatorHashes, function(err, headers){
      if (err){
        return callback(err);
      }
      headers.shift();
      callback(null, headers);
    });
  });
};



module.exports = new SyncService();