'use strict';

require('classtool');


function spec() {
  
  var async           = require('async'),
      RpcClient       = require('bitcore/RpcClient').class(),
      BitcoreTransaction     = require('bitcore/Transaction').class(),
      Address         = require('bitcore/Address').class(),
      BitcoreBlock    = require('bitcore/Block').class(),
      networks        = require('bitcore/networks'),
      util            = require('bitcore/util/util'),
      bignum          = require('bignum'),
      config          = require('../../config/config'),
      sockets         = require('../controllers/socket.js'),
      TransactionItem = require('./TransactionItem');

  var CONCURRENCY = 15;


  function Transaction() {
    this.txid = null;
  }


  Transaction.fromIdWithInfo = function (txid,cb) {
    var tx = new Transaction();
    tx.txid = txid;

    tx.fillInfo(function(err) {
      if (err) return cb(err);
      if (! tx.info ) return cb();

      return cb(err,tx);
    });
  };



  Transaction.prototype.fillInfo = function(next) {
    var self  = this;

    Transaction.queryInfo(self.txid, function(err, info) {
      if (err) return next(err);

      self.info = info;
      return next();
    });
  };


  Transaction.getOutpoints = function (tx, next) {

    if (tx.isCoinBase()) return next();

    var rpc = new RpcClient(config.bitcoind);
    var network   = ( config.network === 'testnet') ? networks.testnet : networks.livenet ;

    async.forEachLimit(tx.ins, CONCURRENCY, function(i, cb) {

        var outHash       = i.getOutpointHash();
        var outIndex      = i.getOutpointIndex();
        var outHashBase64 = outHash.reverse().toString('hex');

        var c=0;
        rpc.getRawTransaction(outHashBase64, function(err, txdata) {
          var txin = new BitcoreTransaction();
          if (err || ! txdata.result) return cb( new Error('Input TX '+outHashBase64+' not found'));

          var b = new Buffer(txdata.result,'hex');
          txin.parse(b);

          /*
          *We have to parse it anyways. It will have outputs even it is a coinbase tx
            if ( txin.isCoinBase() ) {
            return cb();
            }
        */

          txin.outs.forEach( function(j) {
            // console.log( c + ': ' + util.formatValue(j.v) );
            if (c === outIndex) {
              i.value = j.v;

              // This is used for pay-to-pubkey transaction in which
              // the pubkey is not provided on the input
              var scriptPubKey = j.getScript();
              var hash         = scriptPubKey.simpleOutHash();
              if (hash) {
                var addr          = new Address(network.addressPubkey, hash);
                i.addrFromOutput  = addr.toString();
              }
            }
            c++;
          });
          return cb();
        });
      },
      function(err) {
        return next(err);
      }
    );
  };


  Transaction.queryInfo = function(txid,  cb) {
    var self = this;
    var network   = ( config.network === 'testnet') ? networks.testnet : networks.livenet ;
    var rpc      = new RpcClient(config.bitcoind);

    rpc.getRawTransaction(txid, 1, function(err, txInfo) {

      // Not found?
      if (err && err.code === -5) return cb();

      if (err) return cb(err);

      var info = txInfo.result;

      // Transaction parsing
      var b  = new Buffer(txInfo.result.hex,'hex');
      var tx = new BitcoreTransaction();
      tx.parse(b);

      self.getOutpoints(tx, function(err) {
        if (err) return cb(err);

        // Copy TX relevant values to .info

        var c = 0;
        var valueIn  = bignum(0);
        var valueOut = bignum(0);

        if ( tx.isCoinBase() ) {
          info.isCoinBase = true;
        }
        else {
          tx.ins.forEach(function(i) {
            if (i.value) {
              info.vin[c].value = parseFloat(util.formatValue(i.value));
              var n = util.valueToBigInt(i.value).toNumber();
              info.vin[c].valueSat = n;
              valueIn           = valueIn.add( n );

              var scriptSig     = i.getScript();
              var pubKey        = scriptSig.simpleInPubKey();

              // We check for pubKey in case a broken / strange TX.
              if (pubKey) {
                var pubKeyHash    = util.sha256ripe160(pubKey);
                var addr          = new Address(network.addressPubkey, pubKeyHash);
                var addrStr       = addr.toString();
                info.vin[c].addr  = addrStr;
              }
              else {
                if (i.addrFromOutput)
                  info.vin[c].addr  = i.addrFromOutput;
              }
            }
            else {
              console.log('TX could not be parsed: %s,%d' ,txInfo.result.txid, c);
            }
            c++;
          });
        }

        c=0;
        tx.outs.forEach( function(i) {
          var n =  util.valueToBigInt(i.v).toNumber();
          valueOut = valueOut.add(n);

          info.vout[c].valueSat = n;
          c++;
        });

        info.valueOut = valueOut / util.COIN;

        if ( !tx.isCoinBase() ) {
          info.valueIn  = valueIn / util.COIN;
          info.fees    = (valueIn - valueOut) / util.COIN;
        }
        else  {
          var reward =  BitcoreBlock.getBlockValue(info.height) / util.COIN;
          info.vin[0].reward = reward;
          info.valueIn = reward;
        }

        info.size     = b.length;
        return cb(null, info);
      });
    });
  };

  return Transaction;
}
module.defineClass(spec);


