'use strict';
var util = require('util');
var cluster = require('cluster');
var EventEmitter = require('events').EventEmitter;
var bcoin = require('bcoin');
var Peer = bcoin.peer;
var NetAddress = bcoin.netaddress;
var mongoose = require('mongoose');
var async = require('async');
var ProgressBar = require('progress');

var config = require('../config');
var Block = mongoose.model('Block');
var Transaction = mongoose.model('Transaction');
var workerService = require('./worker');

var P2pService = function() {
  this.headersQueue = [];
  this.syncing = false;
  this.blockRates = [];
  this.peer = Peer.fromOptions({
    network: config.network,
    agent: 'fullNodePlus',
    hasWitness: function(){
      return false;
    }
  });
};

util.inherits(P2pService, EventEmitter);

P2pService.prototype.start = function(ready) {
  var self = this;
  if(config.chainSource !== 'p2p') {
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
  this.peer.on('packet', function(msg){
    if(msg.cmd === 'block') {
      var block = msg.block.toBlock();
      if(!block.verify()){
        return;
      }
      self.emit(block.rhash(), block);
      self.emit('block', block);
      return;
    }
    if(msg.cmd === 'tx') {
      self.emit('transaction', msg.tx);
      return;
    }
    if(msg.cmd === 'headers') {
      self.emit('headers', msg.items);
      return;
    }
    if(msg.cmd === 'inv') {
      self.emit('inv', msg.items);
      self.peer.getData(msg.items);
      return;
    }
  });
  var addr = NetAddress.fromHostname(config.p2pHost, config.network);
  this.peer.connect(addr);
  this.peer.tryOpen();
  this.peer.on('open', function(){
    self.sync();
    self.on('block', self.blockHandler.bind(self));
    self.on('transaction', self.transactionHandler.bind(self));
    ready();
  });
};

P2pService.prototype.stop = function() {

};

P2pService.prototype.sync = function(done) {
  var self = this;
  done = done || function() {};
  Block.getLocalTip(function(err, bestBlock) {
    if(bestBlock.height === self.getPeerHeight()) {
      self.syncing = false;
      return done();
    }
    self.syncing = true;
    var counter = 0;
    var bar = new ProgressBar('syncing [:bar] :percent :blockRate blocks/s :blocksEta hrs :blockTime', {
      curr: bestBlock.height,
      complete: '=',
      incomplete: ' ',
      width: 30,
      total: self.getPeerHeight()
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
          self.getBlock(header._hhash, function(err, block) {
            var start = Date.now();
            Block.addBlock(block, function(err) {
              var end = Date.now();
              counter++;
              self.blockRates.push(1 / ((end - start) / 1000));
              if(self.blockRates.length > 144) {
                self.blockRates.shift();
              }
              var avgBlockRate = self.blockRates.reduce(function(p, c, i, a) {return p + (c / a.length);}, 0);
              bar.tick({
                blockTime: new Date(block.ts * 1000).toISOString(),
                blockRate: avgBlockRate.toFixed(1),
                blocksEta: ((((self.getPeerHeight() - bestBlock.height) - counter) / avgBlockRate) / 3600).toFixed(1)
              });
              cb(err);
            });
          });
        }, function(err) {
          cb(err);
        });
      },
      function(err) {
        if(err) {
          console.error(err);
          if(err.message === 'REORG'){
            self.sync();
          }
        } else {
          console.log('Sync completed!!');
          self.syncing = false;
        }
      }
    );
  });
};

P2pService.prototype.getPeerHeight = function() {
  return this.peer.height;
};

P2pService.prototype._getHeaders = function(candidateHashes, callback) {
  candidateHashes = candidateHashes.map(function(candidateHash){
    return bcoin.util.revHex(candidateHash);
  });
  this.peer.sendGetHeaders(candidateHashes);
  this.once('headers', function(headers){
    headers.map(function(header){
      return header.getJSON();
    });
    callback(null, headers);
  });
};

P2pService.prototype.getHeaders = function(callback) {
  var self = this;
  Block.getLocatorHashes(function(err, locatorHashes) {
    if(err) {
      return callback(err);
    }
    self._getHeaders(locatorHashes, function(err, headers) {
      if(err) {
        return callback(err);
      }
      callback(null, headers);
    });
  });
};

P2pService.prototype.getBlock = function(hash, callback) {
  var self = this;
  self.peer.getBlock([hash]);
  var rhash = bcoin.util.revHex(hash);
  self.once(rhash, function(block){
    callback(null, block);
  });
};

P2pService.prototype.blockHandler = function(block) {
  if(this.syncing) {
    return;
  }
  Block.addBlock(block, function() {
    //emit block event
  });
};

P2pService.prototype.transactionHandler = function(transaction) {
  workerService.sendTask('syncTransactionAndOutputs', {
    transaction: transaction.frame().data.toString('hex'),
    mempool: true,
    mainChain: false
  }, function() {
    //emit tx event
  });
};


module.exports = new P2pService();