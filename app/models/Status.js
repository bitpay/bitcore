'use strict';

require('classtool');

function spec() {
  var async     = require('async');
  var RpcClient = require('bitcore/RpcClient').class();
  var config    = require('../../config/config');
  var rpc       = new RpcClient(config.bitcoind);

  function Status() {
    this.info = {};
    this.difficulty = {};
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
      }
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

  return Status;

}
module.defineClass(spec);

