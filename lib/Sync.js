'use strict';

require('classtool');


function spec() {
  var sockets         = require('../app/controllers/socket.js');
  var BlockDb         = require('./BlockDb').class();
  var TransactionDb   = require('./TransactionDb').class();
  var async           = require('async');


  function Sync() {
  }

  Sync.prototype.init = function(opts, cb) {
    var self = this;
    self.opts = opts;
    this.bDb     = new BlockDb(opts);
    this.txDb    = new TransactionDb(opts);
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
   *    1) Get NEW.prev recusively until existing block
   *    then case 0) / 1) / 2)
   *          
   */

  Sync.prototype.storeTipBlock = function(b, cb) {
    var self = this;
    var oldTip, oldNext, needReorg = true;
    var newPrev = b.previousblockhash;
    var updatedTxs, updatedAddrs;

    async.series([
      function(c) {
        self.txDb.createFromBlock(b, function(err, txs, addrs) {
          updatedTxs   = txs;
          updatedAddrs = addrs;
          return c(err);
        });
      },
      function(c) {
        self.bDb.getTip(function(err, val) {
          oldTip = val;
          if (typeof oldTip === 'undefined' || newPrev === oldTip) {
            needReorg = false;
          }
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

        console.log('NEW TIP: %s NEED REORG', b.hash, oldTip);
        // TODO should modify  updatedTxs and addrs.
        self.processReorg(oldTip, oldNext, newPrev, cb);
      },
      function(c) {
        self.bDb.setNext(newPrev, b.hash, function(err) {
          return c(err);
        });
      }],
      function(err) {
        self._handleBroadcast(b, updatedTxs, updatedAddrs);
        return cb(err);
      });
  };



  Sync.prototype.processReorg = function(oldTip, oldNext, newPrev, cb) {
    var self = this;

    var newPrevExisted, orphanizeFrom;

    async.series([
      function(c) {
        self.bDb.has(newPrev, function(err, ret) {
          newPrevExisted = ret;
          return c();
        });
      },
      function(c) {
        if (newPrevExisted) return c();
        console.log('[BlockDb.js.133] case 3) not implemented yet in reorg'); //TODO
        process.exit(1);
      },
      function(c) {
        self.bDb.isMain(newPrev, function(err,val) {
          if (!val) return c();
          // case 1
          orphanizeFrom = oldNext;
          return c(err);
        });
      },
      function(c) {
        if (orphanizeFrom) return c();

        self.setBranchConnectedBackwards(newPrev, function(err, yHash) {
          if (err) return c(err);
          self.bDb.getNext(yHash, function(err, yHashNext) {
            orphanizeFrom = yHashNext;
            return c(err);
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

  Sync.prototype.setBlockMain = function(hash, isMain, cb) {
    var self = this;

    self.bDb.setMain(hash, isMain, function(err) {
      if (err) return cb(err);
      return self.txDb.handleBlockChange(hash, isMain, cb);
    });
  };

  Sync.prototype.setBranchConnectedBackwards = function(fromHash, cb) {
    var self = this,
        hashInterator = fromHash,
        isMain;

    async.doWhilst(
      function(c) {
        self.setConnected(hashInterator, function (err) {
          if (err) return c(err);
          self.bDb.getPrev(hashInterator, function (err, val) {
            if (err) return c(err);
            hashInterator = val;
            self.bDb.isMain(hashInterator, function (err, val) {
              isMain = val;
              return c();
            });
          });
        });
      },
      function() { return hashInterator; }, cb);
  };

  Sync.prototype._handleBroadcast = function(hash, updatedTxs, updatedAddrs) {
    var self = this;

    if (hash && self.opts.broadcast_blocks) {
      sockets.broadcast_block({hash: hash});
    }

    if (updatedTxs && self.opts.broadcast_txs) {
      updatedTxs.forEach(function(tx) {
        sockets.broadcast_tx(tx);
      });
    }

    if (updatedAddrs && self.opts.broadcast_addresses) {
      updatedAddrs.forEach(function(addr, txs){
        txs.forEach(function(addr, t){
          sockets.broadcast_address_tx(addr, {'txid': t});

        });
      });
    }
  };

  Sync.prototype.storeTxs = function(txs, cb) {
    var self = this;

    self.txDb.createFromArray(txs, null, function(err, updatedTxs, updatedAddrs) {
      if (err) return cb(err);

      self._handleBroadcast(null, updatedTxs, updatedAddrs);
      return cb(err);
    });
  };
  return Sync;
}
module.defineClass(spec);

