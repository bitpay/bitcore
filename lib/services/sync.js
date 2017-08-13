'use strict';
var cluster = require('cluster');
var async = require('async');
var _ = require('underscore');
var mongoose = require('mongoose');
var bcoin = require('bcoin');
var ProgressBar = require('progress');

var config = require('../config');
var Block = mongoose.model('Block');
var Transaction = mongoose.model('Transaction');
var p2p = require('./p2p');
var workerService = require('./worker');

var SyncService = function(){
  this.headersQueue = [];
  this.syncing = false;
  this.blockRates = [];
};

SyncService.prototype.sync = function(done) {
  var self = this;
  done = done || function(){};
  self.getLocalTip(function(err, bestBlock){
    if(bestBlock.height === p2p.getPeerHeight()){
      self.syncing = false;
      return done();
    }
    self.syncing = true;
    var counter = 0;
    var bar = new ProgressBar('syncing [:bar] :percent :blockRate blocks/s :blocksEta hrs :blockTime', {
      curr: bestBlock.height,
      complete: '=',
      incomplete: ' ',
      width: 40,
      total: p2p.getPeerHeight()
    });

    async.during(
      function(cb) {
        self.getHeaders(function(err, headers) {
          self.headersQueue = headers;
          cb(err, headers.length);
        });
      },
      function(cb) {
        async.eachSeries(self.headersQueue, function(header, cb) {
          p2p.getBlock(header._hhash, function(err, block) {
            var start = Date.now();
            Block.addBlock(block, function(err) {
              var end = Date.now();
              counter++;
              self.blockRates.push(1 / ((end - start) / 1000));
              if (self.blockRates.length > 144){
                self.blockRates.shift();
              }
              var avgBlockRate = self.blockRates.reduce(function(p, c, i, a) {return p + (c / a.length);}, 0);
              bar.tick({
                blockTime: new Date(block.ts * 1000).toISOString(),
                blockRate: avgBlockRate.toFixed(1),
                blocksEta: ((((p2p.getPeerHeight() - bestBlock.height) - counter) / avgBlockRate)/3600).toFixed(1)
              });
              cb(err);
            });
          });
        }, function(err) {
          cb(err);
        });
      },
      function(err) {
        if(!err){
          self.syncing = false;
        }
      }
    );
  });
};

SyncService.prototype.start = function(ready){
  var self = this;
  if(cluster.isMaster) {
    self.sync();
    p2p.on('block', self.blockHandler.bind(self));
    p2p.on('transaction', self.transactionHandler.bind(self));
  } else {
    process.on('message', function(payload) {
      if(payload.task === 'syncTransactionAndOutputs') {
        Transaction.syncTransactionAndOutputs(payload.argument, function(err) {
          process.send({id: payload.id, error: err});
        });
      }
      if(payload.task === 'syncTransactionInputs') {
        Transaction.syncTransactionInputs(payload.argument, function(err) {
          process.send({id: payload.id, error: err});
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
      return bcoin.network.get(config.network).genesis;
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
      return callback(null, [bcoin.network.get(config.network).genesis.hash]);
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

SyncService.prototype.blockHandler = function(block) {
  if (this.syncing){
    return;
  }
  Block.addBlock(block, function(){
    //emit block event
  });
};

SyncService.prototype.transactionHandler = function(transaction){
  workerService.sendTask('syncTransactionAndOutputs', {
    transaction: JSON.stringify(transaction.toJSON()),
    mempool: true,
    mainChain: false
  }, function(){
    //emit tx event
  });
};



module.exports = new SyncService();