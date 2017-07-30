'use strict';
var cluster = require('cluster');

var async = require('async');
var _ = require('underscore');
var mongoose = require('mongoose');

var rpc = require('../rpc');
var Block = mongoose.model('Block');
var Transaction = mongoose.model('Transaction');

var SyncService = function(){
  this.blockTimes = new Array(144);
};

SyncService.prototype.sync = function(done) {
  var self = this;
  rpc.getChainTip(function(err, chainTip) {
    Block.find({}).limit(1).sort({height: -1}).exec(function(err, localTip) {
      if(err) {
        return done(err);
      }
      localTip = (localTip[0] && localTip[0].height) || 0;
      if(localTip >= chainTip.height - 6) {
        return done();
      }
      var targetHeight = chainTip.height - 6;
      async.eachSeries(_.range(localTip, targetHeight), function(blockN, blockCb) {
        rpc.getBlockByHeight(blockN, function(err, block) {
          if(err) {
            return blockCb(err);
          }
          var start = Date.now();
          Block.processBlock(block, blockN, function(err) {
            if(err) {
              return blockCb(err);
            }
            var end = Date.now();
            self.blockTimes.push(end - start);
            self.blockTimes.shift();
            // console.log('tx/s :\t\t\t' + (block.transactions.length / (end - start) * 1000).toFixed(2));
            var avgBlockTime = _.reduce(_.compact(self.blockTimes), function(total, time) {
              return total + time;
            }, 0) / _.compact(self.blockTimes).length;
            if(!Number.isNaN(avgBlockTime)) {
              console.log('est hours left:\t\t' +
                ((targetHeight - blockN) * avgBlockTime / 1000 / 60 / 60).toFixed(2));
            }
            console.log('added block:\t\t' + blockN);
            console.log('===============================================================');

            blockCb(err);
          });
        });
      }, function(err) {
        if(err) {
          console.error('Syncing failed: ' + err);
          return done(err);
        }
        console.log('Sync completed');
        done();
      });
    });
  });
};

SyncService.prototype.start = function(ready){
  var self = this;
  if(cluster.isMaster) {
    self.sync(function() {
      setTimeout(function() {
        self.sync(function() {});
      }, 60000);
    });
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

module.exports = new SyncService();