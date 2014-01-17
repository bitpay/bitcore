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

  Sync.prototype.storeBlock = function(block, cb) {
    var that = this;

    Block.customCreate(block, function(err, block, inserted_txs){

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


  Sync.prototype.syncBlocks = function(start, end, isForward, cb) {
    var that = this;

    console.log('Syncing Blocks, starting \n\tfrom: %s \n\tend: %s \n\tisForward:',
                  start, end, isForward);


    return that.getPrevNextBlock( start, end,
                  isForward ? { next: 1 } : { prev: 1}, cb);
  };

  Sync.prototype.init = function(opts, cb) {
    var that = this;

    that.opts = opts;

    if (!(opts && opts.skip_db_connection)) {
      mongoose.connect(config.db, {server: {auto_reconnect: true}} );

      this.db = mongoose.connection;

      this.db.on('error', function(err) {
          console.log('connection error:' + err);
          mongoose.disconnect();
      });

      this.db.on('disconnect', function(err) {
          console.log('disconnect:' + err);
          mongoose.connect(config.db, {server: {auto_reconnect: true}} );
      });

      return that.db.once('open', cb);
    }
    else return cb();
  };

  Sync.prototype.close = function() {
    if (!(this.opts && this.opts.skip_db_connection)) {
      console.log('closing connection');
      this.db.close();
    }
  };
  return Sync;
}
module.defineClass(spec);

