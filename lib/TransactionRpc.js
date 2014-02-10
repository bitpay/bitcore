'use strict';

require('classtool');


function spec(b) {
  var RpcClient       = require('bitcore/RpcClient').class(),
//      networks         = require('bitcore/network'),
      BitcoreTransaction = require('bitcore/Transaction').class(),
//      BitcoreBlock = require('bitcore/Block').class(),
//      util         = require('bitcore/util/util'),
      config       = require('../config/config');

   var  rpc  = b.rpc || new RpcClient(config.bitcoind);

  function TransactionRpc() {
  }

  TransactionRpc._parseRpcResult = function(info) {
    var b  = new Buffer(info.hex,'hex');
    var tx = new BitcoreTransaction();
    tx.parse(b);

    // Inputs
    if (tx.isCoinBase())  {
      info.isCoinBase = true;
    }

    var n =0;
    info.vin.forEach(function(i) {
      i.n = n++;
    });

    // Outputs
    var valueOutSat = 0;
    info.vout.forEach( function(o) {
      valueOutSat += o.value * util.COIN;
    });
    info.valueOut = parseInt(valueOutSat) / util.COIN;
    info.size     = b.length;

    return info;
  };

  TransactionRpc.getRpcInfo = function(txid,  cb) {
    var Self = this;

    rpc.getRawTransaction(txid, 1, function(err, txInfo) {

      // Not found?
      if (err && err.code === -5) return cb();
      if (err) return cb(err);

      var info = Self._parseRpcResult(txInfo.result);

      return cb(null,info);
    });
  };

  return TransactionRpc;
}
module.defineClass(spec);


