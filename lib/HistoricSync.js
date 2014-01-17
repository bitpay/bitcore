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

    var genesisHashReversed = new Buffer(32);
    this.network.genesisBlock.hash.copy(genesisHashReversed);
    this.genesis = genesisHashReversed.reverse().toString('hex');
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

    var self = this;

    // recursion end.
    if (!blockHash ) return cb();

    var existed = 0;
    var blockInfo;
    var blockObj;

    async.series([
      // Already got it?
      function(c) {
        Block.findOne({hash:blockHash}, function(err,block){
          if (err) { p(err); return c(err); }
          if (block) {
            existed  =1;
            blockObj =block;
          }
          return c();
        });
      },
      //show some (inacurate) status
      function(c) {
        if (self.block_count % 1000 === 1) {
          progress_bar('sync status:', self.block_count, self.block_total);
        }
        return c();
      },
      //get Info from RPC
      function(c) {

        // TODO: if we store prev/next, no need to go to RPC
        // if (blockObj && blockObj.nextBlockHash) return c();

        self.rpc.getBlock(blockHash, function(err, ret) {
          if (err) return c(err);

          blockInfo = ret;
          return c();
        });
      },
      //store it
      function(c) {
        if (existed) return c();
        self.sync.storeBlock(blockInfo.result, function(err) {

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

        if (err)
          p('ERROR: @%s: %s [count: block_count: %d]', blockHash, err, self.block_count);

        if (opts.uptoexisting && existed) {
          p('DONE. Found existing block: ', blockHash);
          return cb(err);
        }

        if (blockEnd && blockEnd === blockHash) {
          p('DONE. Found END block: ', blockHash);
          return cb(err);
        }


        // Continue
        if (blockInfo && blockInfo.result) {
          self.block_count++;
          if (opts.prev && blockInfo.result.previousblockhash) {
            return self.getPrevNextBlock(blockInfo.result.previousblockhash, blockEnd, opts, cb);
          }

          if (opts.next && blockInfo.result.nextblockhash)
            return self.getPrevNextBlock(blockInfo.result.nextblockhash, blockEnd, opts, cb);
        }
        return cb(err);
    });
  };

  HistoricSync.prototype.import_history = function(opts, next) {
    var self = this;

    var retry_attemps = 100;
    var retry_secs    = 2;

    var block_best;
    var block_height;

    async.series([
      function(cb) {
        if (opts.destroy) {
          p('Deleting Blocks...');
          self.db.collections.blocks.drop(cb);
        } else {
          return cb();
        }
      },
      function(cb) {
        if (opts.destroy) {
          p('Deleting TXs...');
          self.db.collections.transactions.drop(cb);
        } else {
          return cb();
        }
      },
      function(cb) {
        if (opts.destroy) {
          p('Deleting TXItems...');
          self.db.collections.transactionitems.drop(cb);
        } else {
          return cb();
        }
      },
      function(cb) {
        self.rpc.getInfo(function(err, res) {
          if (err) return cb(err);

          self.block_total = res.result.blocks;
          return cb();
        });
      },
      // We are not using getBestBlockHash, because is not available in all clients
      function(cb) {
        if (!opts.reverse) return cb();

        self.rpc.getBlockCount(function(err, res) {
          if (err) return cb(err);
          block_height = res.result;
          return cb();
        });
      },
      function(cb) {
        if (!opts.reverse) return cb();

        self.rpc.getBlockHash(block_height, function(err, res) {
          if (err) return cb(err);

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
            end       = self.genesis;
            opts.prev      = true;
          }
          else {
            start     = self.genesis;
            end       = null;
            opts.next      = true;
          }

          p('Starting from: ', start);
          p('         to  : ', end);
          p('         opts: ', JSON.stringify(opts));

          self.getPrevNextBlock( start, end, opts , function(err) {
            if (err && err.message.match(/ECONNREFUSED/) && retry_attemps--){
              setTimeout(function() {
                p('Retrying in %d secs', retry_secs);
                sync();
              }, retry_secs * 1000);
            }
            else
              return next(err, self.block_count);
          });
        }
        if (!err)
          sync();
        else
          return next(err, 0);
    });
  };

  // upto if we have genesis block?
  HistoricSync.prototype.smart_import = function(next) {
    var self = this;

    Block.findOne({hash:self.genesis}, function(err, b){
      if (err) return next(err);


      if (!b) {
        p('Could not find Genesis block. Running FULL SYNC');
      }
      else {
        p('Genesis block found. Syncing upto know blocks.');
      }

      var opts = {
        reverse: 1,
        uptoexisting: b ? true: false,
      };

      return self.import_history(opts, next);
    });
  };


  return HistoricSync;
}
module.defineClass(spec);

