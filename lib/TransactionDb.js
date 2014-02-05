'use strict';

require('classtool');


function spec() {

  // blockHash -> txid mapping (to reorgs)
  var ROOT         = 'tx-b-';      //tx-b-<txid>-<block> => 1/0 (connected or not)

  // to show tx outs
  var OUTS_ROOT    = 'txouts-';      //txouts-<txid>-<n> => [addr, btc_sat]

  // to sum up addr balance
  var ADDR_ROOT    = 'txouts-addr-'; //txouts-addr-<addr>-<ts>-<txid>-<n> => + btc_sat
  var SPEND_ROOT   = 'txouts-spend-';//txouts-spend-<txid(out)>-<n(out)> => [txid(in),n(in),ts]

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
      assert      = require('assert');

  var TransactionDb = function(db) {
    this.db = db || levelup(config.leveldb + '/txs');
  };

  TransactionDb.prototype.close = function(cb) {
    this.db.close(cb);
  };

  TransactionDb.prototype.drop = function(cb) {
    var self = this;
    var path = config.leveldb + '/txs';
    self.db.close(function() {
      require('leveldown').destroy(path, function () {
        self.db = levelup(path);
        return cb();
      });
    });
  };


//  TransactionDb.prototype.fromTxIdOne = function(txid, cb) { TODO
  TransactionDb.prototype.has = function(txid, cb) {
    var self = this;

    var k = OUTS_ROOT + txid;
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

  TransactionDb.prototype.fromTxId = function(txid,  cb) {
    var self = this;

    var k = OUTS_ROOT + txid;
    var ret=[];

    // outs.
    self.db.createReadStream({start: k, end: k + '~'})
      .on('data', function (data) {
        var k = data.key.split('-');
        var v = data.value.split(':');
        ret.push({
          addr: v[0],
          value_sat: v[1],
          index: k[2],
        });
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function () {
        var k = SPEND_ROOT + txid;
        var l = ret.length;
        self.db.createReadStream({start: k, end: k + '~'})
          .on('data', function (data) {
            var k = data.key.split('-');
            var v = data.value.split(':');
            var set=0;
            for(var i=0; i<l; i++) {
              if (ret[i].index === k[3]) {
                ret[i].spendTxId= v[0];
                ret[i].spendIndex=v[1];
                set=1;
              }
            }
            assert(set,'Spent could not be stored: tx ' + txid +
                   'spend in TX:' + k[2] + ',' + k[3]);
          })
          .on('error', function (err) {
            return cb(err);
          })
          .on('end', function (err) {
            return cb(err, ret);
          });
      });
  };

  TransactionDb.prototype._fillOutpoints = function(info, cb) {
    var self  = this;

    if (!info || info.isCoinBase) return cb();

    var valueIn = 0;
    var incompleteInputs = 0;
    async.eachLimit(info.vin, CONCURRENCY, function(i, c_in) {
      self.fromTxIdN(i.txid, i.vout, function(err, addr, valueSat) {


        if (err || !addr || !valueSat ) {
          console.log('Could not get TXouts in %s,%d from %s ', i.txid, i.vout, info.txid);
          incompleteInputs = 1;
          return c_in(); // error not scaled
        }
        i.addr     = addr;
        i.valueSat = valueSat;
        i.value    = valueSat / util.COIN;

        valueIn += i.valueSat;
        return c_in();
      });
    },
    function () {
      if (! incompleteInputs ) {
        info.valueIn = valueIn / util.COIN;
        info.fees    = (valueIn - parseInt(info.valueOut * util.COIN))  / util.COIN ;
      }
      else {
        info.incompleteInputs = 1;
      }
      return cb();
    });
  };

  TransactionDb.prototype._getInfo = function(txid, next) {
    var self  = this;

    TransactionRpc.getRpcInfo(txid, function(err, info) {
      if (err) return next(err);

      self._fillOutpoints(info, function() {
        return next(null, info);
      });
    });
  };


  TransactionDb.prototype.fromIdWithInfo = function (txid, cb) {
    var self = this;

    self._getInfo(txid, function(err, info) {
      if (err) return cb(err);
      if (!info ) return cb();

      return cb(err, {txid: txid, info: info} );
    });
  };

  TransactionDb.prototype.fromTxIdN = function(txid, n, cb) {
    var self = this;

    var k = OUTS_ROOT + txid + '-' + n;

    self.db.get(k, function (err,val) {
      if (err && err.notFound) {
        err = null;
      }
      var a = val.split(':');
      return cb(err, a[0], a[1]);
    });
  };

  TransactionDb.prototype.fromAddr = function(addr,  cb) {
    var self = this;

    var k = ADDR_ROOT + addr;
    var ret=[];

    //
    self.db.createReadStream({start: k, end: k + '~'})
      .on('data', function (data) {
        var k = data.key.split('-');
        var v = data.value.split(':');
        ret.push({
          value_sat: v[0],
          ts: k[3],
          txid: k[4],
          index: k[5],
        });
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function () {
        async.each(ret, function(o, e_c) {
          var k = SPEND_ROOT + o.txid + '-' + o.index;
          self.db.get(k, function(err, val) {
            if (err && err.notFound) err=null;
            if (err || !val) return e_c(err);

            var v = val.split(':');
            o.spendTxId= v[0];
            o.spendIndex=v[1];
            return e_c();
          });
        },
        function(err) {
          return cb(err,ret);
        });
      });
  };



  TransactionDb.prototype.removeFromTxId = function(txid, cb) {
    var self = this;

    async.series([
      function(c) {
        self.db.createReadStream({
            start: OUTS_ROOT + txid,
            end: OUTS_ROOT + txid + '~',
          }).pipe(
            self.db.createWriteStream({type:'del'})
          ).on('close', c);
      },
      function(c) {
        self.db.createReadStream({
            start: SPEND_ROOT + txid,
            end: SPEND_ROOT + txid + '~'
          })
          .pipe(
            self.db.createWriteStream({type:'del'})
          ).on('close', c);
      }],
      function(err) {
        cb(err);
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


  TransactionDb.prototype.add = function(tx, cb) {
    var self = this;
    var addrs  = [];
    var is_new = true;

    if (tx.hash) self.adaptTxObject(tx);

    var ts = tx.time;

    async.series([
      // Input Outpoints (mark them as spended)
      function(p_c) {
        if (tx.isCoinBase) return p_c();
        async.forEachLimit(tx.vin, CONCURRENCY,
          function(i, next_out) {
            self.db.batch()
              .put( SPEND_ROOT  + i.txid + '-' + i.vout ,
                   tx.txid + ':' + i.n + ':' + ts)
              .write(next_out);
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

              var addr =  o.scriptPubKey.addresses[0];
              var sat  =  Math.round(o.value * util.COIN);
              self.db.batch()
                .put( OUTS_ROOT + tx.txid + '-' +  o.n, addr + ':' + sat)
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

  TransactionDb.prototype.createFromArray = function(txs, blockHash, next) {
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

          self.add(inInfo, function(err) {
            if (err || !blockHash) return each_cb(err);

            self.db.put(ROOT + t + '-' + blockHash, 1, function(err) {
              return each_cb(err);
            });
          });
        });
      }
      else {
        self.add(t, function(err) {
          if (err) return each_cb(err);

          self.db.put(ROOT + t.txid + '-' + blockHash, 1, function(err) {
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
    if (!b || !b.tx) return next();

    return self.createFromArray(b.tx, b.hash, next);
  };


  TransactionDb.prototype.setOrphan = function(blockHash, next) {
//    var self = this;

    //Get Txs
// TODO

      //Mark Tx's output as fromOrphan
      //Mark Tx's outpoiunt as fromOrphan. Undo spents
    return next();
  };


 return TransactionDb;
}
module.defineClass(spec);
