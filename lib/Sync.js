'use strict';

require('classtool');


function spec() {
  var sockets         = require('../app/controllers/socket.js');
  var BlockDb         = require('./BlockDb').class();
  var bitutil = require('bitcore/util/util');

  // This is 0.1.2 => c++ version of base57-native
  var base58        = require('base58-native');
  var encodedData   = require('bitcore/util/EncodedData').class({base58: base58});
  var versionedData = require('bitcore/util/VersionedData').class({superclass: encodedData});
  var Address = require('bitcore/Address').class({superclass: versionedData});
  var TransactionDb   = require('./TransactionDb').class();
  var config = require('../config/config');
  var networks = require('bitcore/networks');
  var Script = require('bitcore/Script').class();
  var async           = require('async');


  function Sync() {
  }

  Sync.prototype.init = function(opts, cb) {
    var self = this;
    self.opts = opts;
    this.bDb     = new BlockDb(opts);
    this.txDb    = new TransactionDb(opts);
    this.network = config.network === 'testnet' ? networks.testnet: networks.livenet;
    return cb();
  };

  Sync.prototype.close = function(cb) {
    var self = this;
    self.txDb.close(function() {
      self.bDb.close(cb);
    });
  };


  Sync.prototype.destroy = function(next) {
    var self = this;
    async.series([
      function(b) { self.bDb.drop(b); },
      function(b) { self.txDb.drop(b); },
    ], next);
  };

  /*
   * Arrives a NEW block, which is the new TIP
   *
   * Case 0) Simple case
   *    A-B-C-D-E(TIP)-NEW
   *
   * Case 1)
   *    A-B-C-D-E(TIP)
   *        \ 
   *         NEW
   *
   *  1) Declare D-E orphans (and possible invalidate TXs on them)
   *
   * Case 2)
   *    A-B-C-D-E(TIP)
   *        \ 
   *         F-G-NEW
   *  1) Set F-G as connected (mark TXs as valid)
   *  2) Declare D-E orphans (and possible invalidate TXs on them)         
   *
   *
   * Case 3)
   *
   *    A-B-C-D-E(TIP) ...  NEW
   *
   *    NEW is ignored 
   *          
   */

  Sync.prototype.storeTipBlock = function(b, allowReorgs, cb) {

    if (typeof allowReorgs === 'function') {
      cb = allowReorgs;
      allowReorgs = true;
    }
    if (!b) return cb();

    var self = this;
    var oldTip, oldNext, needReorg = false;
    var newPrev = b.previousblockhash;
    var updatedAddrs;

    async.series([
      function(c) {
        self.bDb.has(b.hash, function(err, val) {
          return c(err ||
                   (val ? new Error('WARN: Ignoring already existing block:' + b.hash) : null ));
        });
      },
      function(c) {
        if (!allowReorgs) return c();

        self.bDb.has(newPrev, function(err, val) {
          if (!val && newPrev.match(/^0+$/)) return c();
          return c(err ||
                   (!val ? new Error('WARN: Ignoring block with non existing prev:' + b.hash) : null ));
        });
      },
      function(c) {
        self.txDb.createFromBlock(b, function(err, addrs) {
          updatedAddrs = addrs;
          return c(err);
        });
      },
      function(c) {
        if (!allowReorgs) return c();
        self.bDb.getTip(function(err, val) {
          oldTip = val;
          if (oldTip && newPrev !== oldTip) needReorg = true;
          return c();
        });
      },
      function(c) {
        if (!needReorg) return c();

        self.bDb.getNext( newPrev, function(err, val) {
          if (err) return c(err);
          oldNext = val;
          return c();
        });
      },
      function(c) {
        self.bDb.add(b, c);
      },
      function(c) {
        if (!needReorg) return c();
        console.log('NEW TIP: %s NEED REORG (old tip: %s)', b.hash, oldTip);
        self.processReorg(oldTip, oldNext, newPrev, c);
      },
      function(c) {
        self.bDb.setTip(b.hash, function(err) {
          if (err) return c(err);
          self.bDb.setNext(newPrev, b.hash, function(err) {
            return c(err);
          });
        });
      }],
      function(err) {
        if (!err) self._handleBroadcast(b.hash, null, updatedAddrs);
        if (err && err.toString().match(/WARN/) ) {
          err=null;
        }
        return cb(err);
      });
  };



  Sync.prototype.processReorg = function(oldTip, oldNext, newPrev, cb) {
    var self = this;

    var orphanizeFrom;

    async.series([
      function(c) {
        self.bDb.isMain(newPrev, function(err,val) {
          if (!val) return c();

          console.log('# Reorg Case 1)');
          // case 1
          orphanizeFrom = oldNext;
          return c(err);
        });
      },
      function(c) {
        if (orphanizeFrom) return c();

        console.log('# Reorg Case 2)');
        self.setBranchConnectedBackwards(newPrev, function(err, yHash, newYHashNext) {
          if (err) return c(err);
          self.bDb.getNext(yHash, function(err, yHashNext) {
            orphanizeFrom = yHashNext;
            self.bDb.setNext(yHash, newYHashNext, function(err) {
              return c(err);
            });
          });
        });
      },
      function(c) {
        if (!orphanizeFrom) return c();
        self.setBranchOrphan(orphanizeFrom, function(err) {
          return c(err);
        });
      },
    ],
    function(err) {
      return cb(err);
  });
  };

  Sync.prototype.setBlockMain = function(hash, isMain, cb) {
    var self = this;
    self.bDb.setMain(hash, isMain, function(err) {
      if (err) return cb(err);
      return self.txDb.handleBlockChange(hash, isMain, cb);
    });
  };

  Sync.prototype.setBranchOrphan = function(fromHash, cb) {
    var self = this,
        hashInterator = fromHash;

    async.whilst(
      function() { return hashInterator; },
      function(c) {
        self.setBlockMain(hashInterator, false, function(err) {
          if (err) return cb(err);
          self.bDb.getNext(hashInterator, function (err, val) {
            hashInterator = val;
            return c(err);
          });
        });
      }, cb);
  };

  Sync.prototype.setBranchConnectedBackwards = function(fromHash, cb) {
    var self = this,
        hashInterator = fromHash,
        lastHash = fromHash,
        isMain;

    async.doWhilst(
      function(c) {
        self.setBlockMain(hashInterator, true, function (err) {
          if (err) return c(err);
          self.bDb.getPrev(hashInterator, function (err, val) {
            if (err) return c(err);
            lastHash      = hashInterator;
            hashInterator = val;
            self.bDb.isMain(hashInterator, function (err, val) {
              isMain = val;
              return c();
            });
          });
        });
      },
      function() { return hashInterator && !isMain; },
      function(err) {
        console.log('\tFound yBlock:', hashInterator);
        return cb(err, hashInterator, lastHash);
      }
    );
  };

  Sync.prototype._handleBroadcast = function(hash, updatedTxs, updatedAddrs) {
    var self = this;

    if (self.opts.shouldBroadcast) {
      if (hash) {
        sockets.broadcastBlock(hash);
      }

      if (updatedTxs) {
        updatedTxs.forEach(function(tx) {
          sockets.broadcastTx(tx);
        });
      }

      if (updatedAddrs ) {
        updatedAddrs.forEach(function(addr, txs){
          txs.forEach(function(addr, t){
            sockets.broadcastAddressTx(addr, t);
          });
        });
      }
    }
  };

  Sync.prototype.storeTxs = function(txs, cb) {
    var self = this;

    self.txDb.createFromArray(txs, null, function(err, updatedAddrs) {
      if (err) return cb(err);

      self._handleBroadcast(null, txs, updatedAddrs);
      return cb(err);
    });
  };


  // TODO. replace with 
  // Script.prototype.getAddrStrs if that one get merged in bitcore
  Sync.prototype.getAddrStr = function(s) {
    var self = this;

    var addrStrs = [];
    var type = s.classify();
    var addr;

    switch(type) {
      case Script.TX_PUBKEY:
        var chunk = s.captureOne();
        addr = new Address(self.network.addressPubkey, bitutil.sha256ripe160(chunk));
        addrStrs = [ addr.toString() ];
        break;
      case  Script.TX_PUBKEYHASH:
        addr = new Address(self.network.addressPubkey, s.captureOne());
        addrStrs = [ addr.toString() ];
        break;
      case Script.TX_SCRIPTHASH:
        addr = new Address(self.network.addressScript, s.captureOne());
        addrStrs = [ addr.toString() ];
        break;
      case Script.TX_MULTISIG:
        var chunks = s.capture();
        chunks.forEach(function(chunk) {
          var a = new Address(self.network.addressPubkey,  bitutil.sha256ripe160(chunk));
          addrStrs.push(a.toString());
        });
        break;
      case Script.TX_UNKNOWN:
        break;
    }

    return addrStrs;
  };
  return Sync;
}
module.defineClass(spec);

