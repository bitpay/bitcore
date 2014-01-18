'use strict';

require('classtool');


function spec() {
  var mongoose        = require('mongoose');
  var config          = require('../config/config');
  var Block           = require('../app/models/Block');
  var Transaction     = require('../app/models/Transaction');
  var sockets         = require('../app/controllers/socket.js');


  function Sync() {
    this.tx_count   = 0;
  }

  Sync.prototype.init = function(opts, cb) {
    var that = this;

    that.opts = opts;

    if (!(opts && opts.skip_db_connection)) {


      if (!mongoose.connection.readyState == 1) {
        mongoose.connect(config.db, function(err) {
          if (err) {
            console.log('CRITICAL ERROR: connecting to mongoDB:',err);
            return (err);
          }
        });
      }

      that.db = mongoose.connection;

      that.db.on('error', function(err) {
          console.log('MongoDB ERROR:' + err);
          return cb(err);
      });

      that.db.on('disconnect', function(err) {
          console.log('MongoDB disconnect:' + err);
          return cb(err);
      });

      return that.db.once('open', function(err) {
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

  Sync.prototype.storeBlock = function(block, cb) {
    var that = this;

    Block.customCreate(block, function(err, block, inserted_txs){
      if (err) return cb(err);

      if (block && that.opts.broadcast_blocks) {
        sockets.broadcast_block(block);
      }

      if (inserted_txs && that.opts.broadcast_txs) {
        inserted_txs.forEach(function(tx) {
          sockets.broadcast_tx(tx);
        });
      }

      if (inserted_txs)
        that.tx_count += inserted_txs.length;

      return cb();
    });
  };


  Sync.prototype.storeTxs = function(txs, inTime, cb) {
    var that = this;

    var time = inTime ? inTime : Math.round(new Date().getTime() / 1000);

    Transaction.createFromArray(txs, time, function(err, inserted_txs) {
      if (!err && inserted_txs && that.opts.broadcast_txs) {

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

