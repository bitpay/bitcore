'use strict';

require('classtool');

function spec() {
  var async     = require('async');
  var RpcClient = require('bitcore/RpcClient').class();
  var config    = require('../../config/config');
  var rpc       = new RpcClient(config.bitcoind);

  function Status() {
    this.info = {};
  }

  Status.prototype.getInfo = function(next) {
    var that = this;
    async.series([
      function (cb) {
        rpc.getInfo(function(err, block){
          if (err) return cb(err);

          that.info = block.result;
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

