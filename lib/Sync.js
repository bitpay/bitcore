'use strict';

require('classtool');


function spec() {
  var mongoose        = require('mongoose');
  var config          = require('../config/config');
  var sockets         = require('../app/controllers/socket.js');
  var BlockDb         = require('./BlockDb').class();
  var TransactionDb   = require('./TransactionDb').class();
  var async           = require('async');


  function Sync() {
    this.blockDb = new BlockDb();
    this.txDb    = new TransactionDb();
  }

  Sync.prototype.init = function(opts, cb) {
    var self = this;

    self.opts = opts;

    if (!(opts && opts.skipDbConnection)) {

      if (mongoose.connection.readyState !== 1) {
        mongoose.connect(config.db, function(err) {
          if (err) {
            console.log('CRITICAL ERROR: connecting to mongoDB:',err);
            return (err);
          }
        });
      }

      self.db = mongoose.connection;

      self.db.on('error', function(err) {
          console.log('MongoDB ERROR:' + err);
          return cb(err);
      });

      self.db.on('disconnect', function(err) {
          console.log('MongoDB disconnect:' + err);
          return cb(err);
      });

      return self.db.once('open', function(err) {
        return cb(err);
      });
    }
    else return cb();
  };

  Sync.prototype.close = function() {
    if ( this.db && this.db.readyState ) {
      this.db.close();
    }
  };


  Sync.prototype.destroy = function(next) {
    var self = this;
    async.series([
      function(b) { try {self.blockDb.drop(b);} catch (e) { return b(); } },
      function(b) { try {self.TransactionDb.drop(b);} catch (e) { return b(); } },
    ], next);
  };


  Sync.prototype.hasBlock = function(hash, cb) {
    var self = this;

    return self.blockDb.has(hash, cb);
  };
 
  Sync.prototype.countNotOrphan = function(hash, cb) {
    var self = this;
    return self.blockDb.countNotOrphan(hash, cb);
  };
 

  Sync.prototype.storeBlock = function(block, cb) {
    var self = this;

    self.txDb.createFromBlock(block, function(err, insertedTxs, updateAddrs) {
      if (err) return cb(err);

      self.blockDb.add(block, function(err){
        if (err) return cb(err);
        self._handleBroadcast(block, insertedTxs, updateAddrs);
        return cb();
      });
    });
  };

  Sync.prototype.setOrphan = function(fromBlock, toBlock, c) {
    var self = this;

    var hash = fromBlock;

    async.whilst(
      function () {
        return hash && hash !== toBlock;
      },
      function (w_c) {
        self.txDb.setOrphan(c, function(err, insertedTxs, updateAddrs) {
          if (err) return w_c(err);
          self.blockDb.setOrphan(hash, function(err, prevHash){

            hash = prevHash;
            return w_c(err);
          });
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

    // TODO
    self.txDb.createFromTxs(txs, function(err, inserted_txs, updated_addrs) {
      if (err) return cb(err);

      self._handleBroadcast(null, inserted_txs, updated_addrs);
      return cb(err);
    });
  };
  return Sync;
}
module.defineClass(spec);

