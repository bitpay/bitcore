'use strict';

require('classtool');


function spec() {
  var mongoose        = require('mongoose');
  var config          = require('../config/config');
  var Block           = require('../app/models/Block');
  var TransactionItem = require('../app/models/TransactionItem');
  var sockets         = require('../app/controllers/socket.js');
  var async           = require('async');


  function Sync() {
    this.tx_count   = 0;
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
      function(b) { return self.db.collections.blocks.drop(b);},
      function(b) { return self.db.collections.transactionitems.drop(b);},
    ], next);
  };

  Sync.prototype.storeBlock = function(block, cb) {
    var self = this;

    Block.customCreate(block, function(err, block, inserted_txs){
      if (err) return cb(err);

      if (block && self.opts.broadcast_blocks) {
        sockets.broadcast_block(block);
      }

      if (inserted_txs && self.opts.broadcast_txs) {
        inserted_txs.forEach(function(tx) {
          sockets.broadcast_tx(tx);
        });
      }

      if (inserted_txs)
        self.tx_count += inserted_txs.length;

      return cb();
    });
  };


  Sync.prototype.storeTxs = function(txs, cb) {
    var self = this;

    TransactionItem.createFromArray(txs, function(err, inserted_txs) {
      if (!err && inserted_txs && self.opts.broadcast_txs) {

        inserted_txs.forEach(function(tx) {
          sockets.broadcast_tx(tx);
        });
      }

      return cb(err);
    });
  };
  return Sync;
}
module.defineClass(spec);

