'use strict';
var async = require('async');
var _ = require('underscore');
var mongoose = require('mongoose');
var bcoin = require('bcoin');

var Block = mongoose.model('Block');
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
        p2p.getBlock(header._hhash, function(err, block){
          Block.addBlock(block, cb);
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
  this.sync();
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