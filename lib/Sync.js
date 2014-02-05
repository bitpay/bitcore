'use strict';

require('classtool');


function spec() {
  var sockets         = require('../app/controllers/socket.js');
  var BlockDb         = require('./BlockDb').class();
  var TransactionDb   = require('./TransactionDb').class();
  var async           = require('async');


  function Sync() {
    this.bDb     = new BlockDb();
    this.txDb    = new TransactionDb();
  }

  Sync.prototype.init = function(opts, cb) {
    var self = this;

    self.opts = opts;

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


  Sync.prototype.storeBlock = function(block, cb) {
    var self = this;

    self.txDb.createFromBlock(block, function(err, insertedTxs, updateAddrs) {
      if (err) return cb(err);

      self.bDb.add(block, function(err){
        if (err) return cb(err);
        self._handleBroadcast(block, insertedTxs, updateAddrs);
        return cb();
      });
    });
  };

  Sync.prototype.checkOrphan = function(fromBlock, toBlock, c) {
    var self = this;

    var hash = fromBlock;

    var co = 0;
    var limit = 10;
    var cont = 1;

    async.whilst(
      function () {
        if (++co > limit) {
console.log('[Sync.js.109] WARN: Reach reog depth limit'); //TODO
        }
        return cont && hash && hash !== toBlock && co < limit;
      },
      function (w_c) {
        //check with RPC if the block is mainchain
        self.bDb.fromHashWithInfo(hash, function (err, info) {

          if (!info) {
            console.log('[Sync.js.107:hash:ORPHAN]',hash); //TODO
            self.txDb.setOrphan(hash, function(err) {
              if (err) return w_c(err);
              self.bDb.setOrphan(hash, function(err, prevHash){
                hash = prevHash;
                return w_c(err);
              });
            });
          }
          else {
            console.log('[Sync.js.107:hash:NOT ORPHAN]',hash); //TODO
            cont = 0;
            return w_c();
          }
        });
      },
      function (err) {
        return c(err);
      }
    );
  };

  Sync.prototype._handleBroadcast = function(hash, inserted_txs, updated_addrs) {
    var self = this;

    if (hash && self.opts.broadcast_blocks) {
      sockets.broadcast_block({hash: hash});
    }

    if (inserted_txs && self.opts.broadcast_txs) {
      inserted_txs.forEach(function(tx) {
        sockets.broadcast_tx(tx);
      });
    }

    if (updated_addrs && self.opts.broadcast_addresses) {
      updated_addrs.forEach(function(addr, txs){
        txs.forEach(function(addr, t){
          sockets.broadcast_address_tx(addr, {'txid': t});

        });
      });
    }
  };



  Sync.prototype.storeTxs = function(txs, cb) {
    var self = this;

    // TODO -- Peertopeer
    /*
    self.txDb.createFromTxs(txs, function(err, inserted_txs, updated_addrs) {
      if (err) return cb(err);

      self._handleBroadcast(null, inserted_txs, updated_addrs);
      return cb(err);
    });
    */
  };
  return Sync;
}
module.defineClass(spec);

