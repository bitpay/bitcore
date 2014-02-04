'use strict';

require('classtool');


function spec() {
  var ROOT         = 'tx-';      //tx-<txid>-<n> => [addr, btc_sat]
  var OUTS_ROOT    = 'txouts-';      //txouts-<txid>-<n> => [addr, btc_sat]
  var ADDR_ROOT    = 'txouts-addr-'; //txouts-addr-<addr>-<ts>-<txid>-<n> => (+/-) btc_sat

  // TODO: use bitcore networks module
  var genesisTXID = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';
  var CONCURRENCY = 100;

  /**
  * Module dependencies.
  */
  var TransactionRpc = require('./TransactionRpc').class(),
      util        = require('bitcore/util/util'),
      levelup     = require('levelup'),
      async       = require('async'),
      config      = require('../config/config'),
      fs          = require('fs');

  var TransactionDb = function() {
    this.db = levelup(config.leveldb + '/txs');
  };

  TransactionDb.prototype.drop = function(cb) {
    var self = this;
    var path = config.leveldb + '/blocks';
    require('leveldown').destroy(path, function () {
      fs.mkdirSync(config.leveldb);
      fs.mkdirSync(path);
      self.db = levelup(path);
      return cb();
    });
  };

/*
  txidBuf: {
    type: Buffer,
    index: true,
  },
  index: Number,
  addr: {
    type: String,
    index: true,
  },
  value_sat: Number,
  fromOrphan: Boolean,

  spendTxIdBuf: Buffer,
  spendIndex: Number,
  spendFromOrphan: Boolean,
 */

//  TransactionDb.prototype.fromTxIdOne = function(txid, cb) { TODO
  TransactionDb.prototype.has = function(txid, cb) {
    var self = this;

    var k = ROOT + txid;
    self.db.get(k, function (err,val) {

      var ret;

      if (err && err.notFound) {
        err = null;
        ret = false;
      }
      if (typeof val !== undefined) {
        ret = true;
      }
      return cb(err, ret);
    });
  };


  TransactionDb.prototype.fromTxIdN = function(txid, n, cb) {
    var self = this;

    var k = OUTS_ROOT + txid + '-' + n;

    self.db.get(k, function (err,val) {
      if (err && err.notFound) {
        err = null;
      }

      var a = val.split('-');

      return cb(err, val, a[0], a[1]);
    });
  };

  TransactionDb.prototype.adaptTxObject = function(txInfo) {

    // adapt bitcore TX object to bitcoind JSON response
    txInfo.txid = txInfo.hash;

    var count = 0;
    txInfo.vin = txInfo.in.map(function (txin) {
      var i = {};
    
      if (txin.coinbase) {
        txInfo.isCoinBase = true;
      }
      else {
        i.txid= txin.prev_out.hash;
        i.vout= txin.prev_out.n;
      }
      i.n = count++;
      return i;
    });


    count = 0;
    txInfo.vout = txInfo.out.map(function (txout) {
      var o = {};
    
      o.value = txout.value;
      o.n = count++;

      if (txout.addrStr){
        o.scriptPubKey = {};
        o.scriptPubKey.addresses = [txout.addrStr];
      }
      return o;
    });
  };


  TransactionDb.prototype.add = function(tx, fromOrphan, cb) {
    var self = this;
    var addrs  = [];
    var is_new = true;

    if (tx.hash) self.adaptTxObject(tx);

    //TODO
    var ts = 1;


    //TODO
    if (fromOrphan) return cb();

    async.series([
      // Input Outpoints (mark them as spended)
      function(p_c) {
        if (tx.isCoinBase) return p_c();
        async.forEachLimit(tx.vin, CONCURRENCY,
          function(i, next_out) {

            // TODO
return next_out();

/*            self.db.batch()
              .put()
            var data = {
                txidBuf: b,
                index: i.vout,

                spendTxIdBuf: bTxId,
                spendIndex: i.n,
            };
            if (fromOrphan) data.spendFromOrphan = true;
            Self.update({txidBuf: b, index: i.vout}, data, {upsert: true}, next_out);
*/
          },
          function (err) {
            if (err) {
              if (!err.message.match(/E11000/)) {
                console.log('ERR at TX %s: %s', tx.txid,  err);
                return cb(err);
              }
            }
            return p_c();
        });
      },
      // Parse Outputs
      function(p_c) {
        async.forEachLimit(tx.vout, CONCURRENCY,
          function(o, next_out) {
            if (o.value && o.scriptPubKey &&
              o.scriptPubKey.addresses &&
              o.scriptPubKey.addresses[0] &&
              ! o.scriptPubKey.addresses[1] // TODO : not supported
            ){

              // This is only to broadcast (WIP)
  //            if (addrs.indexOf(o.scriptPubKey.addresses[0]) === -1) {
  //              addrs.push(o.scriptPubKey.addresses[0]);
  //            }

              //if (fromOrphan) data.fromOrphan = true; // TODO
              
              var addr =  o.scriptPubKey.addresses[0];
              var sat  =  o.value * util.COIN;
              self.db.batch()
                .put( OUTS_ROOT + tx.txid + o.n, addr + ':' + sat)
                .put( ADDR_ROOT + addr + '-' + ts  + '-' + tx.txid +
                     '-' +  o.n, sat)
                .write(next_out);

            }
            else {
              console.log ('WARN in TX: %s could not parse OUTPUT %d', tx.txid, o.n);
              return next_out();
            }
          },
          function (err) {
            if (err) {
              if (err.message.match(/E11000/)) {
                is_new = false;
              }
              else {
                console.log('ERR at TX %s: %s', tx.txid,  err);
                return cb(err);
              }
            }
            return p_c();
        });
      }], function(err) {
        return cb(err, addrs, is_new);
    });
  };

  TransactionDb.prototype.createFromArray = function(txs, fromOrphan, blockHash, next) {
    var self = this;

    if (!txs) return next();

    // TODO
    var insertedTxs = [];
    var updatedAddrs = {};

    async.forEachLimit(txs, CONCURRENCY, function(t, each_cb) {
      if (typeof t === 'string') {
        // Is it from genesis block? (testnet==livenet)
        // TODO: parse it from networks.genesisTX?
        if (t === genesisTXID) return each_cb();

        TransactionRpc.getRpcInfo(t, function(err, inInfo) {
          if (!inInfo) return each_cb(err);

          self.add(inInfo, fromOrphan, function(err) {
            if (err) return each_cb(err);

            self.db.put(ROOT + t, blockHash, function(err) {
              return each_cb(err);
            });
          });
        });
      }
      else {
        self.add(t, fromOrphan, function(err) {
          if (err) return each_cb(err);

          self.db.put(ROOT + t.txid, blockHash, function(err) {
            return each_cb(err);
          });
        });
      }
    },
    function(err) {


      return next(err, insertedTxs, updatedAddrs);
  });
};


// txs can be a [hashes] or [txObjects]
  TransactionDb.prototype.createFromBlock = function(b, next) {
    var self = this;
    if (!b.tx) return next();

    return self.createFromArray(b.tx, b.isOrphan, b.hash, next);
  };

 return TransactionDb;
}
module.defineClass(spec);
