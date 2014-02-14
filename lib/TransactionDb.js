'use strict';

require('classtool');


function spec(b) {

  var superclass = b.superclass || require('events').EventEmitter;
  // blockHash -> txid mapping 
  var IN_BLK_PREFIX = 'txb-'; //txb-<txid>-<block> => 1/0 (connected or not)

  // Only for orphan blocks
  var FROM_BLK_PREFIX = 'tx-'; //tx-<block>-<txid> => 1 

  // to show tx outs
  var OUTS_PREFIX = 'txo-'; //txo-<txid>-<n> => [addr, btc_sat]
  var SPEND_PREFIX = 'txs-'; //txs-<txid(out)>-<n(out)>-<txid(in)>-<n(in)> = ts

  // to sum up addr balance (only outs, spends are gotten later)
  var ADDR_PREFIX = 'txa-'; //txa-<addr>-<txid>-<n> => + btc_sat:ts

  // TODO: use bitcore networks module
  var genesisTXID = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';
  var CONCURRENCY = 100;

  /**
   * Module dependencies.
   */
  var Rpc = b.rpc || require('./Rpc').class(),
    util = require('bitcore/util/util'),
    levelup = require('levelup'),
    async = require('async'),
    config = require('../config/config'),
    assert = require('assert');
  var db = b.db || levelup(config.leveldb + '/txs');
  var Script = require('bitcore/Script').class();
  // This is 0.1.2 => c++ version of base57-native
  var base58 = require('base58-native');
  var encodedData = require('bitcore/util/EncodedData').class({
    // TODO: check why c++ implementation differs
    //base58: base58
  });
  var versionedData = require('bitcore/util/VersionedData').class({
    superclass: encodedData
  });
  var Address = require('bitcore/Address').class({
    superclass: versionedData
  });
  var bitutil = require('bitcore/util/util');
  var networks = require('bitcore/networks');

  var TransactionDb = function() {
    TransactionDb.super(this, arguments);
    this.network = config.network === 'testnet' ? networks.testnet : networks.livenet;
  };
  TransactionDb.superclass = superclass;

  TransactionDb.prototype.close = function(cb) {
    db.close(cb);
  };

  TransactionDb.prototype.drop = function(cb) {
    var path = config.leveldb + '/txs';
    db.close(function() {
      require('leveldown').destroy(path, function() {
        db = levelup(path);
        return cb();
      });
    });
  };


  TransactionDb.prototype.has = function(txid, cb) {

    var k = OUTS_PREFIX + txid;
    db.get(k, function(err, val) {

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

  TransactionDb.prototype._addSpendInfo = function(r, txid, index, ts) {
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
    } else {
      r.spendTxId = txid;
      r.spendIndex = parseInt(index);
      r.spendTs = parseInt(ts);
    }
  };


  // This is not used now
  TransactionDb.prototype.fromTxId = function(txid, cb) {
    var self = this;
    var k = OUTS_PREFIX + txid;
    var ret = [];
    var idx = {};
    var i = 0;

    // outs.
    db.createReadStream({
      start: k,
      end: k + '~'
    })
      .on('data', function(data) {
        var k = data.key.split('-');
        var v = data.value.split(':');
        ret.push({
          addr: v[0],
          value_sat: parseInt(v[1]),
          index: parseInt(k[2]),
        });
        idx[parseInt(k[2])] = i++;
      })
      .on('error', function(err) {
        return cb(err);
      })
      .on('end', function() {

        var k = SPEND_PREFIX + txid;
        db.createReadStream({
          start: k,
          end: k + '~'
        })
          .on('data', function(data) {
            var k = data.key.split('-');
            var j = idx[parseInt(k[2])];

            assert(typeof j !== 'undefined', 'Spent could not be stored: tx ' + txid +
              'spend in TX:' + k[1] + ',' + k[2] + ' j:' + j);

            self._addSpendInfo(ret[j], k[3], k[4], data.value);
          })
          .on('error', function(err) {
            return cb(err);
          })
          .on('end', function(err) {
            return cb(err, ret);
          });
      });
  };


  TransactionDb.prototype._fillSpend = function(info, cb) {
    var self = this;

    if (!info) return cb();

    var k = SPEND_PREFIX + info.txid;
    db.createReadStream({
      start: k,
      end: k + '~'
    })
      .on('data', function(data) {
        var k = data.key.split('-');
        self._addSpendInfo(info.vout[k[2]], k[3], k[4], data.value);
      })
      .on('error', function(err) {
        return cb(err);
      })
      .on('end', function(err) {
        return cb(err);
      });
  };


  TransactionDb.prototype._fillOutpoints = function(info, cb) {
    var self = this;

    if (!info || info.isCoinBase) return cb();

    var valueIn = 0;
    var incompleteInputs = 0;

    async.eachLimit(info.vin, CONCURRENCY, function(i, c_in) {
        self.fromTxIdN(i.txid, i.vout, function(err, ret) {
          //console.log('[TransactionDb.js.154:ret:]',ret); //TODO
          if (!ret || !ret.addr || !ret.valueSat) {
            console.log('Could not get TXouts in %s,%d from %s ', i.txid, i.vout, info.txid);
            if (ret) i.unconfirmedInput = ret.unconfirmedInput;
            incompleteInputs = 1;
            return c_in(); // error not scalated
          }

          info.firstSeenTs = ret.spendTs;
          i.unconfirmedInput = i.unconfirmedInput;
          i.addr = ret.addr;
          i.valueSat = ret.valueSat;
          i.value = ret.valueSat / util.COIN;

          // Double spend?
          if (ret.multipleSpendAttempt || !ret.spendTxId ||
            (ret.spendTxId && ret.spendTxId !== info.txid)
          ) {
            if (ret.multipleSpendAttempts) {
              ret.multipleSpendAttempts.each(function(mul) {
                if (mul.spendTxId !== info.txid) {
                  i.doubleSpendTxID = ret.spendTxId;
                  i.doubleSpendIndex = ret.spendIndex;
                }
              });
            } else if (!ret.spendTxId) {
              i.dbError = 'Input spend not registered';
            } else {
              i.doubleSpendTxID = ret.spendTxId;
              i.doubleSpendIndex = ret.spendIndex;
            }
          } else {
            i.doubleSpendTxID = null;
          }

          valueIn += i.valueSat;
          return c_in();
        });
      },
      function() {
        if (!incompleteInputs) {
          info.valueIn = valueIn / util.COIN;
          info.fees = (valueIn - parseInt(info.valueOut * util.COIN)) / util.COIN;
        } else {
          info.incompleteInputs = 1;
        }
        return cb();
      });
  };

  TransactionDb.prototype._getInfo = function(txid, next) {
    var self = this;

    Rpc.getRpcInfo(txid, function(err, info) {
      if (err) return next(err);

      self._fillOutpoints(info, function() {
        self._fillSpend(info, function() {
          return next(null, info);
        });
      });
    });
  };


  TransactionDb.prototype.fromIdWithInfo = function(txid, cb) {
    var self = this;

    self._getInfo(txid, function(err, info) {
      if (err) return cb(err);
      if (!info) return cb();
      return cb(err, {
        txid: txid,
        info: info
      });
    });
  };

  TransactionDb.prototype.fromTxIdN = function(txid, n, cb) {
    var self = this;
    var k = OUTS_PREFIX + txid + '-' + n;

    db.get(k, function(err, val) {
      if (!val || (err && err.notFound)) {
        return cb(null, {
          unconfirmedInput: 1
        });
      }

      var a = val.split(':');
      var ret = {
        addr: a[0],
        valueSat: parseInt(a[1]),
      };

      // Spend?
      var k = SPEND_PREFIX + txid + '-' + n;
      db.createReadStream({
        start: k,
        end: k + '~'
      })
        .on('data', function(data) {
          var k = data.key.split('-');
          self._addSpendInfo(ret, k[3], k[4], data.value);
        })
        .on('error', function(error) {
          return cb(error);
        })
        .on('end', function() {
          return cb(null, ret);
        });
    });
  };

  TransactionDb.prototype.fillConfirmations = function(o, cb) {
    var self = this;

    self.isConfirmed(o.txid, function(err, is) {
      if (err) return cb(err);

      o.isConfirmed = is;
      if (!o.spendTxId) return cb();

      if (o.multipleSpendAttempts) {

        async.each(o.multipleSpendAttempts,
          function(oi, e_c) {
            self.isConfirmed(oi.spendTxId, function(err, is) {
              if (err) return;
              if (is) {
                o.spendTxId = oi.spendTxId;
                o.index = oi.index;
                o.spendIsConfirmed = 1;
              }
              return e_c();
            });
          }, cb);
      } else {
        self.isConfirmed(o.spendTxId, function(err, is) {
          if (err) return cb(err);
          o.spendIsConfirmed = is;
          return cb();
        });
      }
    });
  };

  TransactionDb.prototype.fromAddr = function(addr, cb) {
    var self = this;

    var k = ADDR_PREFIX + addr;
    var ret = [];

    db.createReadStream({
      start: k,
      end: k + '~'
    })
      .on('data', function(data) {
        var k = data.key.split('-');
        var v = data.value.split(':');
        ret.push({
          txid: k[2],
          index: parseInt(k[3]),
          value_sat: parseInt(v[0]),
          ts: parseInt(v[1]),
        });
      })
      .on('error', function(err) {
        return cb(err);
      })
      .on('end', function() {

        async.each(ret, function(o, e_c) {
            var k = SPEND_PREFIX + o.txid + '-' + o.index;
            db.createReadStream({
              start: k,
              end: k + '~'
            })
              .on('data', function(data) {
                var k = data.key.split('-');
                self._addSpendInfo(o, k[3], k[4], data.value);
              })
              .on('error', function(err) {
                return e_c(err);
              })
              .on('end', function(err) {
                return e_c(err);
              });
          },
          function() {
            async.each(ret, function(o, e_c) {
              self.fillConfirmations(o, e_c);
            }, function(err) {
              return cb(err, ret);
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
            db.createWriteStream({
              type: 'del'
            })
          ).on('close', c);
        },
        function(c) {
          db.createReadStream({
            start: SPEND_PREFIX + txid,
            end: SPEND_PREFIX + txid + '~'
          })
            .pipe(
              db.createWriteStream({
                type: 'del'
              })
          ).on('close', c);
        }
      ],
      function(err) {
        cb(err);
      });

  };


  // TODO. replace with 
  // Script.prototype.getAddrStrs if that one get merged in bitcore
  TransactionDb.prototype.getAddrStr = function(s) {
    var self = this;

    var addrStrs = [];
    var type = s.classify();
    var addr;

    switch (type) {
      case Script.TX_PUBKEY:
        var chunk = s.captureOne();
        addr = new Address(self.network.addressPubkey, bitutil.sha256ripe160(chunk));
        addrStrs.push(addr.toString());
        break;
      case Script.TX_PUBKEYHASH:
        addr = new Address(self.network.addressPubkey, s.captureOne());
        addrStrs.push(addr.toString());
        break;
      case Script.TX_SCRIPTHASH:
        addr = new Address(self.network.addressScript, s.captureOne());
        addrStrs.push(addr.toString());
        break;
      case Script.TX_MULTISIG:
        var chunks = s.capture();
        chunks.forEach(function(chunk) {
          var a = new Address(self.network.addressPubkey, bitutil.sha256ripe160(chunk));
          addrStrs.push(a.toString());
        });
        break;
      case Script.TX_UNKNOWN:
        break;
    }

    return addrStrs;
  };

  TransactionDb.prototype.adaptTxObject = function(txInfo) {
    var self = this;
    // adapt bitcore TX object to bitcoind JSON response
    txInfo.txid = txInfo.hash;

    
    var to=0;
    var tx = txInfo;
    tx.outs.forEach( function(o) {
      var s = new Script(o.s);
      var addrs = self.getAddrStr(s);

      // support only for p2pubkey p2pubkeyhash and p2sh
      if (addrs.length === 1) {
        tx.out[to].addrStr = addrs[0];
        tx.out[to].n = to;
      }
      to++;
    });

    var count = 0;
    txInfo.vin = txInfo.in.map(function(txin) {
      var i = {};

      if (txin.coinbase) {
        txInfo.isCoinBase = true;
      } else {
        i.txid = txin.prev_out.hash;
        i.vout = txin.prev_out.n;
      }
      i.n = count++;
      return i;
    });


    count = 0;
    txInfo.vout = txInfo.out.map(function(txout) {
      var o = {};

      o.value = txout.value;
      o.n = count++;

      if (txout.addrStr) {
        o.scriptPubKey = {};
        o.scriptPubKey.addresses = [txout.addrStr];
      }
      return o;
    });
  };



  TransactionDb.prototype.add = function(tx, blockhash, cb) {
    var self = this;
    var addrs = [];

    if (tx.hash) self.adaptTxObject(tx);

    var ts = tx.time;

    async.series([
      // Input Outpoints (mark them as spent)
      function(p_c) {
        if (tx.isCoinBase) return p_c();
        async.forEachLimit(tx.vin, CONCURRENCY,
          function(i, next_out) {
            db.batch()
              .put(SPEND_PREFIX + i.txid + '-' + i.vout + '-' + tx.txid + '-' + i.n,
                ts || 0)
              .write(next_out);
          },
          function(err) {
            return p_c(err);
          });
      },
      // Parse Outputs
      function(p_c) {
        async.forEachLimit(tx.vout, CONCURRENCY,
          function(o, next_out) {
            if (o.value && o.scriptPubKey &&
              o.scriptPubKey.addresses &&
              o.scriptPubKey.addresses[0] && !o.scriptPubKey.addresses[1] // TODO : not supported
            ) {
              var addr = o.scriptPubKey.addresses[0];
              var sat = Math.round(o.value * util.COIN);

              if (addrs.indexOf(addr) === -1) {
                addrs.push(addr);
              }

              // existed?
              var k = OUTS_PREFIX + tx.txid + '-' + o.n;
              db.get(k, function(err) {
                if (err && err.notFound) {
                  db.batch()
                    .put(k, addr + ':' + sat)
                    .put(ADDR_PREFIX + addr + '-' + tx.txid + '-' + o.n, sat + ':' + ts)
                    .write(next_out);
                } else {
                  return next_out();
                }
              });
            } else {
              return next_out();
            }
          },
          function(err) {
            if (err) {
              console.log('ERR at TX %s: %s', tx.txid, err);
              return cb(err);
            }
            return p_c();
          });
      },
      function(p_c) {
        if (!blockhash) {
          return p_c();
        }
        return self.setConfirmation(tx.txid, blockhash, true, p_c);
      },
    ], function(err) {
      if (addrs.length > 0 && !blockhash) {
        // only emit if we are processing a single tx (not from a block)
        addrs.forEach(function(addr) {
          self.emit('tx_for_address', {
            address: addr,
            txid: tx.txid
          });
        });
      }
      self.emit('new_tx', {
        tx: tx
      });

      return cb(err);
    });
  };



  TransactionDb.prototype.setConfirmation = function(txId, blockHash, confirmed, c) {
    if (!blockHash) return c();

    confirmed = confirmed ? 1 : 0;

    db.batch()
      .put(IN_BLK_PREFIX + txId + '-' + blockHash, confirmed)
      .put(FROM_BLK_PREFIX + blockHash + '-' + txId, 1)
      .write(c);
  };


  // This slowdown addr balance calculation by 100%
  TransactionDb.prototype.isConfirmed = function(txId, c) {
    var k = IN_BLK_PREFIX + txId;
    var ret = false;

    db.createReadStream({
      start: k,
      end: k + '~'
    })
      .on('data', function(data) {
        if (data.value === '1') ret = true;
      })
      .on('error', function(err) {
        return c(err);
      })
      .on('end', function(err) {
        return c(err, ret);
      });
  };

  TransactionDb.prototype.handleBlockChange = function(hash, isMain, cb) {
    var toChange = [];
    console.log('\tSearching Txs from block:' + hash);

    var k = FROM_BLK_PREFIX + hash;
    var k2 = IN_BLK_PREFIX;
    // This is slow, but prevent us to create a new block->tx index.
    db.createReadStream({
      start: k,
      end: k + '~'
    })
      .on('data', function(data) {
        var ks = data.key.split('-');
        toChange.push({
          key: k2 + ks[2] + '-' + ks[1],
          type: 'put',
          value: isMain ? 1 : 0,
        });
      })
      .on('error', function(err) {
        return cb(err);
      })
      .on('end', function(err) {
        if (err) return cb(err);
        console.log('\t%s %d Txs', isMain ? 'Confirming' : 'Invalidating', toChange.length);
        db.batch(toChange, cb);
      });
  };

  // txs can be a [hashes] or [txObjects]
  TransactionDb.prototype.createFromArray = function(txs, blockHash, next) {
    var self = this;
    if (!txs) return next();

    async.forEachLimit(txs, CONCURRENCY, function(t, each_cb) {
        if (typeof t === 'string') {
          // TODO: parse it from networks.genesisTX?
          if (t === genesisTXID) return each_cb();

          Rpc.getRpcInfo(t, function(err, inInfo) {
            if (!inInfo) return each_cb(err);

            return self.add(inInfo, blockHash, each_cb);
          });
        } else {
          return self.add(t, blockHash, each_cb);
        }
      },
      function(err) {
        return next(err);
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
