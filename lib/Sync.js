'use strict';

require('classtool');


function spec() {
  var mongoose        = require('mongoose');
  var util            = require('util');
  var RpcClient       = require('bitcore/RpcClient').class();
  var networks        = require('bitcore/networks');
  var async           = require('async');
  var config          = require('../config/config');
  var Block           = require('../app/models/Block');
  var Transaction     = require('../app/models/Transaction');
  var TransactionItem = require('../app/models/TransactionItem');
  var sockets         = require('../app/views/sockets/main.js');
  var CONCURRENCY     = 5;


  function Sync(config) {
    this.tx_count   = 0;
    this.block_count= 0;
    this.block_total= 0; 
    this.network    = config.networkName === 'testnet' ? networks.testnet: networks.livenet;
  }

  var progress_bar = function(string, current, total) {
    console.log(util.format('\t%s %d/%d [%d%%]', string, current, total, parseInt(100 * current / total)));
  };

  Sync.prototype.getPrevNextBlock = function(blockHash, blockEnd, opts, cb) {

    var that = this;

    // recursion end.
    if (!blockHash || (blockEnd && blockEnd == blockHash) ) {
      console.log("Reach end:", blockHash, blockEnd);
      return cb();
    }

    var existed = 0;
    var blockInfo;
    var blockObj;

    async.series([ 
      // Already got it?
      function(c) {
        Block.findOne({hash:blockHash}, function(err,block){
          if (err) { console.log(err); return c(err); };
          if (block) {
            existed  = 1;
            blockObj = block;
          }

          return c();
        });
      },
      //show some (inacurate) status
      function(c) {
        if (that.block_count++ % 1000 === 0) {
          progress_bar('Historic sync status:', that.block_count, that.block_total);
        }
        return c();
      },
      //get Info from RPC
      function(c) {

        // TODO: if we store prev/next, no need to go to RPC
        // if (blockObj && blockObj.nextBlockHash) return c();

        that.rpc.getBlock(blockHash, function(err, ret) {
          if (err) return c(err);

          blockInfo = ret;
          return c();
        });
      },
      //store it
      function(c) {
        if (existed) return c();

        that.storeBlock(blockInfo.result, function(err, block) {
          existed = err && err.toString().match(/E11000/);
          if (err && ! existed)  return c(err);
          return c();
        });
      },
      /* TODO: Should Start to sync backwards? (this is for partial syncs)
      function(c) {

        if (blockInfo.result.prevblockhash != current.blockHash) {
          console.log("reorg?");
          opts.prev = 1;
        }
        return c();
        }
      */
      ],
      function (err){ 

        if (err) 
          console.log("ERROR: @%s: %s [count: block_count: %d]", blockHash, err, that.block_count);

        if (blockInfo && blockInfo.result) {
          if (opts.prev && blockInfo.result.previousblockhash) {
            return that.getPrevNextBlock(blockInfo.result.previousblockhash, blockEnd, opts, cb);
          }

          if (opts.next && blockInfo.result.nextblockhash)
            return that.getPrevNextBlock(blockInfo.result.nextblockhash, blockEnd, opts, cb);
        }
        return cb(err);
    });
  };

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

  // This is not currently used. Transactions are represented by txid only
  // in mongodb
  Sync.prototype.syncTXs = function(cb) {

    var that = this;

    console.log('Syncing TXs...');

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


  // Not used
  Sync.prototype.processTXs = function(reindex, cb) {

    var that = this;

    console.log('Syncing TXs...');

    var filter = reindex ? {} : { processed: false } ;

    Transaction.find(filter, function(err, txs) {
      if (err) return cb(err);

      var read = 0,
        pull   = 0,
        proc   = 0,
        total  = txs.length;

      console.log('\tneed to pull %d txs', total);

      if (!total) return cb();


      async.forEachLimit(txs, CONCURRENCY, function(tx, next) {
          if (read++ % 1000 === 0) progress_bar('read', read, total);

          if (!tx.txid) {
            console.log('NO TXID skipping...', tx);
            return next();
          }

          // This will trigger an RPC call
          Transaction.explodeTransactionItems( tx.txid, tx.time, function(err) {
            if (proc++ % 1000 === 0) progress_bar('\tproc', pull, total);
            next(err);
          });
        },
        cb);
    });
  };

  Sync.prototype.init = function(opts) {
    this.rpc = new RpcClient(config.bitcoind);


    if (!(opts && opts.skip_db_connection)) {
      mongoose.connect(config.db, {server: {auto_reconnect: true}} );
    }
    this.opts = opts;
    this.db = mongoose.connection;

    this.db.on('error', function(err) {
        console.log('connection error:' + err);
        mongoose.disconnect();
    });

    this.db.on('disconnect', function(err) {
        console.log('disconnect:' + err);
        mongoose.connect(config.db, {server: {auto_reconnect: true}} );
    });


  };

  Sync.prototype.import_history = function(opts, next) {

    var that = this;

    var retry_attemps = 100;
    var retry_secs    = 2;

    var block_best;

    this.db.once('open', function() {
      async.series([
      function(cb) {
        if (opts.destroy) {
          console.log('Deleting Blocks...');
          that.db.collections.blocks.drop(cb);
        } else {
          return cb();
        }
      },
      function(cb) {
        if (opts.destroy) {
          console.log('Deleting TXs...');
          that.db.collections.transactions.drop(cb);
        } else {
          return cb();
        }
      },
      function(cb) {
        if (opts.destroy) {
          console.log('Deleting TXItems...');
          that.db.collections.transactionitems.drop(cb);
        } else {
          return cb();
        }
      },
      function(cb) {
        that.rpc.getInfo(function(err, res) {
          if (err) cb(err);

          that.block_total = res.result.blocks;
          return cb();
        });
      },
      function(cb) {
        if (!opts.reverse) return cb();

        that.rpc.getBestBlockHash(function(err, res) {
          if (err) cb(err);

          block_best = res.result;
          return cb();
        });
      },
      ], function(err) {


        function sync() {

          var start, end, isForward;

          if (opts.reverse) {
            start     = block_best;
            end       = that.network.genesisBlock.hash.reverse().toString('hex');
            isForward = false;
          }
          else {
            start     = that.network.genesisBlock.hash.reverse().toString('hex');
            end       = null;
            isForward = true;
          }

          that.syncBlocks(start, end, isForward, function(err) {

            if (err && err.message.match(/ECONNREFUSED/) && retry_attemps--){
              setTimeout(function() {
                console.log("Retrying in %d secs ", retry_secs);
                sync();
              }, retry_secs * 1000);
            }
            else  
              return next(err, that.block_count); 
          });
        }

        if (!opts.skip_blocks) {
          sync();
        }
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

