'use strict';

require('classtool');

function spec() {
  var async     = require('async');
  var RpcClient = require('bitcore/RpcClient').class();
  var BlockDb   = require('../../lib/BlockDb').class();
  var config    = require('../../config/config');
  var rpc       = new RpcClient(config.bitcoind);

  function Status() {
    this.bDb = new BlockDb();
  }

  Status.prototype.getInfo = function(next) {
    var that = this;
    async.series([
      function (cb) {
        rpc.getInfo(function(err, info){
          if (err) return cb(err);

          that.info = info.result;
          return cb();
        });
      },
    ], function (err) {
      return next(err);
    });
  };

  Status.prototype.getDifficulty = function(next) {
    var that = this;
    async.series([
      function (cb) {
        rpc.getDifficulty(function(err, df){
          if (err) return cb(err);

          that.difficulty = df.result;
          return cb();
        });
      }
    ], function (err) {
      return next(err);
    });
  };

  Status.prototype.getTxOutSetInfo = function(next) {
    var that = this;
    async.series([
      function (cb) {
        rpc.getTxOutSetInfo(function(err, txout){
          if (err) return cb(err);

          that.txoutsetinfo = txout.result;
          return cb();
        });
      }
    ], function (err) {
      return next(err);
    });
  };

  Status.prototype.getBestBlockHash = function(next) {
    var that = this;
    async.series([
      function (cb) {
        rpc.getBestBlockHash(function(err, bbh){
          if (err) return cb(err);

          that.bestblockhash = bbh.result;
          return cb();
        });
      },

    ], function (err) {
      return next(err);
    });
  };

  Status.prototype.getLastBlockHash = function(next) {
    var that = this;
    that.bDb.getTip(function(err,tip) {
      that.syncTipHash = tip;
      async.waterfall(
        [
          function(callback){
            rpc.getBlockCount(function(err, bc){
              if (err) return callback(err);
              callback(null, bc.result);
            });
          },
          function(bc, callback){
            rpc.getBlockHash(bc, function(err, bh){
              if (err) return callback(err);
              callback(null, bh.result);
            });
          }
        ],
          function (err, result) {
            that.lastblockhash = result;
            return next();
          }
      );
    });
  };

  return Status;

}
module.defineClass(spec);

