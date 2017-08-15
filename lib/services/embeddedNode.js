'use strict';
var cluster = require('cluster');
var bcoin = require('bcoin');
var mkdirp = require('mkdirp');
var async = require('async');
var mongoose = require('mongoose');

var config = require('../config');
var Block = mongoose.model('Block');
var Transaction = mongoose.model('Transaction');
var workerService = require('./worker');

var EmbeddedNode = function(){
  var prefix = './.bcoin/' + config.network;
  mkdirp.sync(prefix);
  this.node = new bcoin.fullnode({
    network: config.network,
    db: 'leveldb',
    checkpoints: true,
    workers: true,
    persistent: true,
    prefix: prefix,
    logConsole: true,
    logLevel: 'info'
  });

};

EmbeddedNode.prototype.start = function(ready){
  var self = this;
  if(config.chainSource !== 'bcoin') {
    return setImmediate(ready);
  }

  if(cluster.isWorker) {
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
    return setImmediate(ready);
  }
  this._startBcoin(function(){
    self.sync();
    self.node.on('connect', self.blockHandler.bind(self));
    self.node.on('tx', self.transactionHandler.bind(self));
    ready();
  });

};

EmbeddedNode.prototype._startBcoin = function(ready){
  var self = this;
  self.node.open().then(function() {
    self.node.connect().then(function() {
      self.node.startSync();
      ready();
    });
  });
};

EmbeddedNode.prototype.stop = function(){

};

EmbeddedNode.prototype.sync = function(done){
  var self = this;
  done = done || function() {};
  var nextHeight;
  self.syncing = true;
  async.during(
    function(cb){
      Block.getLocalTip(function(err, bestBlock){
        nextHeight = bestBlock.height + 1;
        cb(err, self.node.chain.height > bestBlock.height);
      });
    },
    function(cb){
      self.node.getBlock(nextHeight).then(function(block){
        Block.addBlock(block, function(err){
          cb(err);
        });
      });
    },
    function(err){
      if(err) {
        console.error(err);
      } else {
        console.log('Sync completed!!');
        self.syncing = false;
      }
    }
  );
};

EmbeddedNode.prototype.blockHandler = function(block) {
  if(this.syncing) {
    return;
  }
  Block.addBlock(block, function() {
    //emit block event
  });
};

EmbeddedNode.prototype.transactionHandler = function(transaction) {
  workerService.sendTask('syncTransactionAndOutputs', {
    transaction: JSON.stringify(transaction.toJSON()),
    mempool: true,
    mainChain: false
  }, function() {
    //emit tx event
  });
};

module.exports = new EmbeddedNode();