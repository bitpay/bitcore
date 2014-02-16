'use strict';

require('classtool');


function spec(b) {
  var RpcClient       = require('bitcore/RpcClient').class(),
      BitcoreBlock    = require('bitcore/Block').class(),
      bitcoreUtil     = require('bitcore/util/util'),
      util         = require('util'),
      config       = require('../config/config');

   var  bitcoreRpc  = b.bitcoreRpc || new RpcClient(config.bitcoind);

  function Rpc() {
  }

  Rpc._parseTxResult = function(info) {
    var b  = new Buffer(info.hex,'hex');

    // remove fields we dont need, to speed, and adapt the information
    delete info['hex'];

    // Inputs => add index + coinBase flag
    var n =0;
    info.vin.forEach(function(i) {
      i.n = n++;
      if (i.coinbase) info.isCoinBase = true;
      if (i.scriptSig) delete i.scriptSig['hex'];
    });

    // Outputs => add total
    var valueOutSat = 0;
    info.vout.forEach( function(o) {
      valueOutSat += o.value * bitcoreUtil.COIN;
      delete o.scriptPubKey['hex'];
    });
    info.valueOut = parseInt(valueOutSat) / bitcoreUtil.COIN;
    info.size     = b.length;

    return info;
  };


  Rpc.errMsg = function(err) {
    var e = err;
    e.message += util.format(' [Host: %s:%d User:%s Using password:%s]',
                             bitcoreRpc.host,
                             bitcoreRpc.port,
                             bitcoreRpc.user,
                             bitcoreRpc.pass?'yes':'no'
                            );
    return e;
  };

  Rpc.getTxInfo = function(txid,  cb) {
    var self = this;

    bitcoreRpc.getRawTransaction(txid, 1, function(err, txInfo) {

      // Not found?
      if (err && err.code === -5) return cb();
      if (err) return cb(self.errMsg(err));

      var info = self._parseTxResult(txInfo.result);

      return cb(null,info);
    });
  };


  Rpc.blockIndex = function(height, cb) {
    var self = this;

    bitcoreRpc.getBlockHash(height, function(err, bh){
      if (err) return cb(self.errMsg(err));
      cb(null, { blockHash: bh.result });
    });
  };

  Rpc.getBlock = function(hash, cb) {
    var self = this;

    bitcoreRpc.getBlock(hash, function(err,info) {
      // Not found?
      if (err && err.code === -5) return cb();
      if (err) return cb(self.errMsg(err));


      if (info.result.height)
        info.result.reward =  BitcoreBlock.getBlockValue(info.result.height) / bitcoreUtil.COIN ;

      return cb(err,info.result);
    });
  };


  return Rpc;
}
module.defineClass(spec);


