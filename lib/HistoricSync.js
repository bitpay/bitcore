'use strict';

require('classtool');


function spec() {
  var util            = require('util');
  var RpcClient       = require('bitcore/RpcClient').class();
  var networks        = require('bitcore/networks');
  var async           = require('async');
  var config          = require('../config/config');
  var Block           = require('../app/models/Block');
  var Sync            = require('./Sync').class();

  function HistoricSync(opts) {
    this.block_count= 0;
    this.block_total= 0;
    this.network    = config.network === 'testnet' ? networks.testnet: networks.livenet;
    this.sync       = new Sync(opts);
  }

  function p() {
    var args = [];
    Array.prototype.push.apply( args, arguments );
    
    args.unshift('[historic_sync]');
    /*jshint validthis:true */
    console.log.apply(this, args);
  }

  var progress_bar = function(string, current, total) {
    p(util.format('%s %d/%d [%d%%]', string, current, total, parseInt(100 * current / total)));
  };

  HistoricSync.prototype.init = function(opts,cb) {
    this.rpc = new RpcClient(config.bitcoind);
    this.opts = opts;
    this.sync.init(opts, cb);
  };

  HistoricSync.prototype.close = function() {
    this.sync.close();
  };

  HistoricSync.prototype.getPrevNextBlock = function(blockHash, blockEnd, opts, cb) {

    var that = this;

    // recursion end.
    if (!blockHash || (blockEnd && blockEnd === blockHash) ) {
      return cb();
    }

    var existed = 0;
    var blockInfo;
    var blockObj;

    async.series([
      // Already got it?
      function(c) {
        Block.findOne({hash:blockHash}, function(err,block){
          if (err) { p(err); return c(err); }
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
          progress_bar('sync status:', that.block_count, that.block_total);
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

        that.sync.storeBlock(blockInfo.result, function(err) {
          existed = err && err.toString().match(/E11000/);
          if (err && ! existed)  return c(err);
          return c();
        });
      },
      /* TODO: Should Start to sync backwards? (this is for partial syncs)
      function(c) {

        if (blockInfo.result.prevblockhash != current.blockHash) {
          p("reorg?");
          opts.prev = 1;
        }
        return c();
        }
      */
      ],
      function (err){

        if (opts.uptoexisting && existed) {
          p('DONE. Found existing block: %s ', blockHash);
          return cb(err);
        }

        if (err)
          p('ERROR: @%s: %s [count: block_count: %d]', blockHash, err, that.block_count);

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

  HistoricSync.prototype.syncBlocks = function(start, end, opts, cb) {
    var that = this;

    p('Starting from: ', start);
    p('         to  : ', end);
    p('         opts: ', JSON.stringify(opts));

    return that.getPrevNextBlock( start, end, opts , cb);
  };

  HistoricSync.prototype.import_history = function(opts, next) {
    var that = this;

    var retry_attemps = 100;
    var retry_secs    = 2;

    var block_best;
    var block_height;

    async.series([
      function(cb) {
        if (opts.destroy) {
          p('Deleting Blocks...');
          that.db.collections.blocks.drop(cb);
        } else {
          return cb();
        }
      },
      function(cb) {
        if (opts.destroy) {
          p('Deleting TXs...');
          that.db.collections.transactions.drop(cb);
        } else {
          return cb();
        }
      },
      function(cb) {
        if (opts.destroy) {
          p('Deleting TXItems...');
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
      // We are not using getBestBlockHash, because is not available in all clients
      function(cb) {
        if (!opts.reverse) return cb();

        that.rpc.getBlockCount(function(err, res) {
          if (err) cb(err);
          block_height = res.result;
          return cb();
        });
      },
      function(cb) {
        if (!opts.reverse) return cb();

        that.rpc.getBlockHash(block_height, function(err, res) {
          if (err) cb(err);

          block_best = res.result;
          return cb();
        });
      },
      ],
      function(err) {

        var start, end;
        function sync() {
          if (opts.reverse) {
            start     = block_best;
            end       = that.network.genesisBlock.hash.reverse().toString('hex');
            opts.prev      = true;
          }
          else {
            start     = that.network.genesisBlock.hash.reverse().toString('hex');
            end       = null;
            opts.next      = true;
          }

          that.syncBlocks(start, end, opts, function(err) {

            if (err && err.message.match(/ECONNREFUSED/) && retry_attemps--){
              setTimeout(function() {
                p('Retrying in %d secs', retry_secs);
                sync();
              }, retry_secs * 1000);
            }
            else
              return next(err, that.block_count);
          });
        }
        if (!err)
          sync();
        else
          return next(err, 0);
    });
  };

  // Reverse Imports (upto if we have genesis block?)
  HistoricSync.prototype.smart_import = function(next) {
    var that = this;
    var opts = {
      prev: 1,
    };
    that.import_history(opts, next);
  };


  return HistoricSync;
}
module.defineClass(spec);

