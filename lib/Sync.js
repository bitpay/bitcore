'use strict';

require('classtool');

/* We dont sync any contents from TXs, only their IDs are stored */

var isSyncTxEnabled = 0;

function spec() {
  var mongoose = require('mongoose');
  var util = require('util');

  var RpcClient = require('bitcore/RpcClient').class();
  var networks = require('bitcore/networks');
  var async = require('async');

  var config = require('../config/config');
  var Block = require('../app/models/Block');
  var Transaction = require('../app/models/Transaction');

  function Sync(config) {
    this.network = config.networkName === 'testnet' ? networks.testnet: networks.livenet;
  }

  var progress_bar = function(string, current, total) {
    console.log(util.format('\t%s %d/%d [%d%%]', string, current, total, parseInt(100 * current / total)));
  };

  Sync.prototype.getNextBlock = function(blockHash, cb) {
    var that = this;
    if (!blockHash) {
      return cb();
    }
    this.rpc.getBlock(blockHash, function(err, blockInfo) {
      if (err) return cb(err);
      if (blockInfo.result.height % 1000 === 0) {
        var h = blockInfo.result.height,
        d = blockInfo.result.confirmations;
        progress_bar('height', h, h + d);
      }

      that.storeBlock(blockInfo.result, function(err) {
        if (!err) {
          var txs = blockInfo.result.tx;
          that.storeTxs(txs, function(err) {
            if (!err) {
              return that.getNextBlock(blockInfo.result.nextblockhash, cb);
            }
          });
        }
      });
    });
  };

  Sync.prototype.storeBlock = function(block, cb) {
    Block.create(block, function(err, inBlock) {
      // E11000 => already exists
      if (err && ! err.toString().match(/E11000/)) {
        return cb(err);
      }
      cb();
    });
  };

  Sync.prototype.storeTxs = function(txs, cb) {
    Transaction.createFromArray(txs, cb);
  };

  Sync.prototype.syncBlocks = function(reindex, cb) {
    var that = this;
    var genesisHash = this.network.genesisBlock.hash.reverse().toString('hex');

    console.log('Syncing Blocks... ' + reindex);
    if (reindex) {
      return this.getNextBlock(genesisHash, cb);
    }

    Block.findOne({},
    {},
    {
      sort: {
        'time': - 1
      }
    },
    function(err, block) {
      if (err) return cb(err);

      var nextHash = block && block.hash ? block.hash: genesisHash;

      console.log('\tStarting at hash: ' + nextHash);
      return that.getNextBlock(nextHash, cb);
    });
  };

  // This is not currently used. Transactions are represented by txid only
  // in mongodb
  Sync.prototype.syncTXs = function(reindex, cb) {

    var that = this;

    console.log('Syncing TXs...');
    if (reindex) {
      // TODO?
    }

    Transaction.find({
      blockhash: null
    },
    function(err, txs) {
      if (err) return cb(err);

      var read = 0;
      var pull = 0;
      var write = 0;
      var total = txs.length;
      console.log('\tneed to pull %d txs', total);

      if (!total) return cb();

      async.each(txs, function(tx, next) {
        if (!tx.txid) {
          console.log('NO TXID skipping...', tx);
          return next();
        }

        if (read++ % 1000 === 0) progress_bar('read', read, total);

        that.rpc.getRawTransaction(tx.txid, 1, function(err, txInfo) {

          if (pull++ % 1000 === 0) progress_bar('\tpull', pull, total);

          if (!err && txInfo) {
            Transaction.update({
              txid: tx.txid
            },
            txInfo.result, function(err) {
              if (err) return next(err);

              if (write++ % 1000 === 0) progress_bar('\t\twrite', write, total);

              return next();
            });
          }
          else return next();
        });
      },
      function(err) {
        if (err) return cb(err);
        return cb(err);
      });
    });
  };

  Sync.prototype.init = function(opts) {
    if (!(opts && opts.skip_db_connection)) {
      mongoose.connect(config.db);
    }
    this.db = mongoose.connection;
    this.rpc = new RpcClient(config.bitcoind);

    this.db.on('error', console.error.bind(console, 'connection error:'));

  };

  Sync.prototype.import_history = function(opts, next) {

    var that = this;
    this.db.once('open', function() {
      async.series([
      function(cb) {
        if (opts.destroy) {
          console.log('Deleting Blocks...');
          that.db.collections.blocks.drop(cb);
        } else {
          cb();
        }
      },
      function(cb) {
        if (opts.destroy) {
          console.log('Deleting TXs...');
          that.db.collections.transactions.drop(cb);
        } else {
          cb();
        }
      },
      function(cb) {
        if (!opts.skip_blocks) {
          that.syncBlocks(opts.reindex, cb);
        } else {
          cb();
        }
      },
      function(cb) {
        if (isSyncTxEnabled && ! opts.skip_txs) {
          that.syncTXs(opts.reindex, cb);
        }
        else {
          return cb();
        }
      }], function(err) {
        return next(err);
      });
    });
  };

  Sync.prototype.close = function() {
    console.log("closing connection");
    this.db.close();
  };
  return Sync;
}
module.defineClass(spec);

