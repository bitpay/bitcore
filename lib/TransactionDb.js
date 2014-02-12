'use strict';

require('classtool');


function spec(b) {

  // blockHash -> txid mapping 
  var IN_BLK_PREFIX         = 'tx-b-';      //tx-b-<txid>-<block> => 1/0 (connected or not)

  // Only for orphan blocks
  var FROM_BLK_PREFIX       = 'tx-';      //tx-<block>-<txid> => 1 

  // to show tx outs
  var OUTS_PREFIX    = 'txouts-';      //txouts-<txid>-<n> => [addr, btc_sat]

  // to sum up addr balance
  var ADDR_PREFIX    = 'txouts-addr-'; //txouts-addr-<addr>-<ts>-<txid>-<n> => + btc_sat
  var SPEND_PREFIX   = 'txouts-spend-';//txouts-spend-<txid(out)>-<n(out)>-<txid(in)>-<n(in)> = ts

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
  var db = b.db || levelup(config.leveldb + '/txs');

  var TransactionDb = function() {
  };

  TransactionDb.prototype.close = function(cb) {
    db.close(cb);
  };

  TransactionDb.prototype.drop = function(cb) {
    var path = config.leveldb + '/txs';
    db.close(function() {
      require('leveldown').destroy(path, function () {
        db = levelup(path);
        return cb();
      });
    });
  };


  TransactionDb.prototype.has = function(txid, cb) {

    var k = OUTS_PREFIX + txid;
    db.get(k, function (err,val) {

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

  TransactionDb.prototype._addSpendInfo = function(r, txid, index) {
    if (r.spendTxId) {
      if (!r.multipleSpendAttempts) {
        r.multipleSpendAttempts = [{
          txid: r.spendTxId,
          index: r.index,
        }];
      }
      r.multipleSpendAttempts.push({
        txid: txid,
        index: parseInt(index),
      });
    }
    else {
      r.spendTxId  = txid;
      r.spendIndex = parseInt(index);
    }
  };


  // This is not used now
  TransactionDb.prototype.fromTxId = function(txid,  cb) {
    var self = this;
    var k = OUTS_PREFIX + txid;
    var ret=[];
    var idx={};
    var i = 0;

    // outs.
    db.createReadStream({start: k, end: k + '~'})
      .on('data', function (data) {
        var k = data.key.split('-');
        var v = data.value.split(':');
        ret.push({
          addr: v[0],
          value_sat: parseInt(v[1]),
          index: parseInt(k[2]),
        });
        idx[parseInt(k[2])]= i++;
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function () {

        var k = SPEND_PREFIX + txid;
        db.createReadStream({start: k, end: k + '~'})
          .on('data', function (data) {
            var k = data.key.split('-');
            var j = idx[parseInt(k[3])];

            assert(typeof j !== 'undefined','Spent could not be stored: tx ' + txid +
                   'spend in TX:' + k[2] + ',' + k[3]+ ' j:' + j);

            self._addSpendInfo(ret[j],  k[4],  k[5]);
          })
          .on('error', function (err) {
            return cb(err);
          })
          .on('end', function (err) {
            return cb(err, ret);
          });
      });
  };


  TransactionDb.prototype._fillSpend = function(info, cb) {
    var self  = this;

    if (!info) return cb();

    var k = SPEND_PREFIX + info.txid;
    db.createReadStream({start: k, end: k + '~'})
      .on('data', function (data) {
        var k = data.key.split('-');
        self._addSpendInfo(info.vout[k[3]],  k[4],  k[5]);
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function (err) {
        return cb(err);
      });
  };


  TransactionDb.prototype._fillOutpoints = function(info, cb) {
    var self  = this;

    if (!info || info.isCoinBase) return cb();

    var valueIn = 0;
    var incompleteInputs = 0;

    async.eachLimit(info.vin, CONCURRENCY, function(i, c_in) {
      self.fromTxIdN(i.txid, i.vout, function(err, ret) {
        //console.log('[TransactionDb.js.154:ret:]',ret); //TODO
        if (!ret || !ret.addr || !ret.valueSat ) {
          console.log('Could not get TXouts in %s,%d from %s ', i.txid, i.vout, info.txid);
          if (ret) i.unconfirmedInput  = ret.unconfirmedInput;
          incompleteInputs = 1;
          return c_in(); // error not scalated
        }

        i.unconfirmedInput  = i.unconfirmedInput;
        i.addr     = ret.addr;
        i.valueSat = ret.valueSat;
        i.value    = ret.valueSat / util.COIN;

        // Double spend?
        if ( ret.multipleSpendAttempt ||
            !ret.spendTxId ||
            (ret.spendTxId && ret.spendTxId !== info.txid)
          ) {
          if (ret.multipleSpendAttempts ) {
            ret.multipleSpendAttempts.each(function(mul) {
              if (mul.spendTxId !== info.txid) {
                i.doubleSpendTxID  = ret.spendTxId;
                i.doubleSpendIndex = ret.spendIndex;
              }
            });
          }
          else if (!ret.spendTxId) {
            i.dbError = 'Input spend not registered';
          }
          else {
            i.doubleSpendTxID  = ret.spendTxId;
            i.doubleSpendIndex = ret.spendIndex;
          }
        }
        else {
          i.doubleSpendTxID = null;
        }

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
        self._fillSpend(info, function() {
          return next(null, info);
        });
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
    var k = OUTS_PREFIX + txid + '-' + n;

    db.get(k, function (err,val) {
      if (!val || (err && err.notFound) ) {
        return cb(null, { unconfirmedInput: 1} );
      }

      var a = val.split(':');
      var ret = {
        addr:     a[0],
        valueSat: parseInt(a[1]),
      };

      // Spend?
      var k = SPEND_PREFIX + txid + '-' + n;
      db.createReadStream({start: k, end: k + '~'})
      .on('data', function (data) {
        var k = data.key.split('-');
        self._addSpendInfo(ret,  k[4],  k[5]);
      })
      .on('error', function (error) {
        return cb(error);
      })
      .on('end', function () {
        return cb(null,ret);
      });
    });
  };

  TransactionDb.prototype.fillConfirmations = function(o,  cb) {
    var self = this;

    self.isConfirmed(o.txid, function(err,is) {
      if (err) return cb(err);

      o.isConfirmed = is;
      if (!o.spendTxId) return cb();

      if (o.multipleSpendAttempts) {

        async.each(o.multipleSpendAttempts,
          function (oi, e_c) {
            self.isConfirmed(oi.spendTxId, function(err,is) {
              if (err) return;
              if (is) {
                o.spendTxId = oi.spendTxId;
                o.index =  oi.index;
                o.spendIsConfirmed = 1;
              }
              return e_c();
            });
          }, cb);
      }
      else {
        self.isConfirmed(o.spendTxId, function(err,is) {
          if (err) return cb(err);
          o.spendIsConfirmed = is;
          return cb();
        });
      }
    });
  };

  TransactionDb.prototype.fromAddr = function(addr,  cb) {
    var self = this;

    var k = ADDR_PREFIX + addr;
    var ret=[];

    db.createReadStream({start: k, end: k + '~'})
      .on('data', function (data) {
        var k = data.key.split('-');
        var v = data.value.split(':');
        ret.push({
          value_sat: parseInt(v[0]),
          ts: parseInt(k[3]),
          txid: k[4],
          index: parseInt(k[5]),
        });
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function () {

        async.each(ret, function(o, e_c) {
          var k = SPEND_PREFIX + o.txid + '-' + o.index;
          db.createReadStream({start: k, end: k + '~'})
            .on('data', function (data) {
              var k = data.key.split('-');
              self._addSpendInfo(o,  k[4],  k[5]);
            })
            .on('error', function (err) {
              return e_c(err);
            })
            .on('end', function (err) {
              return e_c(err);
            });
        },
        function() {
          async.each(ret, function(o, e_c){
            self.fillConfirmations(o,e_c);
          },function(err) {
            return cb(err,ret);
          });
        });
      });
  };



  TransactionDb.prototype.removeFromTxId = function(txid, cb) {

    async.series([
      function(c) {
        db.createReadStream({
            start: OUTS_PREFIX + txid,
            end: OUTS_PREFIX + txid + '~',
          }).pipe(
            db.createWriteStream({type:'del'})
          ).on('close', c);
      },
      function(c) {
        db.createReadStream({
            start: SPEND_PREFIX + txid,
            end: SPEND_PREFIX + txid + '~'
          })
          .pipe(
            db.createWriteStream({type:'del'})
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



  TransactionDb.prototype.add = function(tx, blockhash, cb) {
    var self = this;
    var addrs  = [];

    if (tx.hash) self.adaptTxObject(tx);

    var ts = tx.time;

    async.series([
      // Input Outpoints (mark them as spended)
      function(p_c) {
        if (tx.isCoinBase) return p_c();
        async.forEachLimit(tx.vin, CONCURRENCY,
          function(i, next_out) {
            db.batch()
              .put( SPEND_PREFIX  + i.txid + '-' + i.vout + '-' +  tx.txid + '-' + i.n, ts || 0)
              .write(next_out);
          },
          function (err) {
            return p_c(err);
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
              if (addrs.indexOf(o.scriptPubKey.addresses[0]) === -1) {
                addrs.push(o.scriptPubKey.addresses[0]);
              }

              var addr =  o.scriptPubKey.addresses[0];
              var sat  =  Math.round(o.value * util.COIN);
              db.batch()
                .put( OUTS_PREFIX + tx.txid + '-' +  o.n, addr + ':' + sat)
                .put( ADDR_PREFIX + addr + '-' + ts  + '-' + tx.txid +
                     '-' +  o.n, sat)
                .write(next_out);

            }
            else {
              //console.log ('WARN in TX: %s could not parse OUTPUT %d', tx.txid, o.n);
              return next_out();
            }
          },
          function (err) {
            if (err) {
              console.log('ERR at TX %s: %s', tx.txid,  err);
              return cb(err);
            }
            return p_c();
        });
      },
      function (p_c) {
        if (!blockhash) return p_c();
        return self.setConfirmation(tx.txid,blockhash, true, p_c);
      },
    ], function(err) {
        return cb(err, addrs);
    });
  };



  TransactionDb.prototype.setConfirmation = function(txId, blockHash, confirmed, c) {
    if (!blockHash) return c();

    confirmed = confirmed ? 1 : 0;

    db.batch()
      .put(IN_BLK_PREFIX + txId + '-' + blockHash, confirmed)
      .put(FROM_BLK_PREFIX + blockHash  + '-' + txId, 1)
      .write(c);
  };


  // This slowdown addr balance calculation by 100%
  TransactionDb.prototype.isConfirmed = function(txId, c) {
    var k = IN_BLK_PREFIX + txId;
    var ret = false;

    db.createReadStream({start: k, end: k + '~'})
      .on('data', function (data) {
        if (data.value === '1') ret = true;
      })
      .on('error', function (err) {
        return c(err);
      })
      .on('end', function (err) {
        return c(err,ret);
      });
  };

  TransactionDb.prototype.handleBlockChange = function(hash, isMain, cb) {
    var toChange = [];
    console.log('\tSearching Txs from block:' + hash);

    var k = FROM_BLK_PREFIX + hash;
    var k2 = IN_BLK_PREFIX;
    // This is slow, but prevent us to create a new block->tx index.
    db.createReadStream({start: k, end: k + '~'})
      .on('data', function (data) {
         var ks = data.key.split('-');
         toChange.push({
           key: k2 + ks[2] + '-' + ks[1],
           type: 'put',
           value: isMain?1:0,
        });
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function (err) {
        if (err) return cb(err);
        console.log('\t%s %d Txs', isMain?'Confirming':'Invalidating',toChange.length);
        db.batch(toChange, cb);
      });
  };

  // txs can be a [hashes] or [txObjects]
  TransactionDb.prototype.createFromArray = function(txs, blockHash, next) {
    var self = this;

    if (!txs) return next();

    var updatedAddrs = []; // TODO

    async.forEachLimit(txs, CONCURRENCY, function(t, each_cb) {
      if (typeof t === 'string') {

        // Is it from genesis block? (testnet==livenet)
        // TODO: parse it from networks.genesisTX?
        if (t === genesisTXID) return each_cb();

        TransactionRpc.getRpcInfo(t, function(err, inInfo) {
          if (!inInfo) return each_cb(err);

          return self.add(inInfo, blockHash, each_cb);
        });
      }
      else {
        return self.add(t, blockHash, each_cb);
      }
    },
    function(err) {
      return next(err, updatedAddrs);
    });
  };


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
