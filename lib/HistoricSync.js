'use strict';

require('classtool');



function spec() {
  var util = require('util');
  var RpcClient = require('bitcore/RpcClient').class();
  var networks = require('bitcore/networks');
  var async = require('async');
  var config = require('../config/config');
  var Block = require('../app/models/Block');
  var Sync = require('./Sync').class();
  var sockets = require('../app/controllers/socket.js');


  var BAD_GEN_ERROR = 'Bad genesis block. Network mismatch between Insight and bitcoind? Insight is configured for:';

  function HistoricSync() {
    this.network = config.network === 'testnet' ? networks.testnet: networks.livenet;

    var genesisHashReversed = new Buffer(32);
    this.network.genesisBlock.hash.copy(genesisHashReversed);
    this.genesis = genesisHashReversed.reverse().toString('hex');


    //available status: starting / syncing / finished / aborted
    this.status = 'starting';
    this.error  = null;

    this.syncPercentage = 0;
    this.syncedBlocks = 0;
    this.skippedBlocks = 0;

  }

  function p() {
    var args = [];
    Array.prototype.push.apply(args, arguments);

    args.unshift('[historic_sync]');
    /*jshint validthis:true */
    console.log.apply(this, args);
  }

  HistoricSync.prototype.setError = function(err) {
    var self = this;
    self.error = err.toString();
    self.status='error';
    self.showProgress();
  };

  HistoricSync.prototype.init = function(opts, cb) {

    var self = this;
    self.opts = opts;

    self.rpc = new RpcClient(config.bitcoind);
    self.sync = new Sync(opts);

    self.sync.init(opts, function(err) {
      if (err) {
        self.setError(err);
        return cb(err);
      }
      else {
        // check testnet?
        self.rpc.getBlockHash(0, function(err, res){
          if (!err && ( res && res.result !== self.genesis)) {
            err = new Error(BAD_GEN_ERROR + config.network);
            self.setError(err);
          }
          if (err) self.setError(err);
          return cb(err);
        });
      }
    });

  };

  HistoricSync.prototype.close = function() {
    this.sync.close();
  };


  HistoricSync.prototype.info = function() {
    return {
      status: this.status,
      blockChainHeight: this.blockChainHeight,
      syncPercentage: this.syncPercentage,
      skippedBlocks: this.skippedBlocks,
      syncedBlocks: this.syncedBlocks,
      error: this.error,
    };
  };

  HistoricSync.prototype.showProgress = function() {
    var self = this;

    if (self.error) {
      p('ERROR: ' +  self.error);
    }
    else {
      self.syncPercentage = parseFloat(100 * self.syncedBlocks / self.blockChainHeight).toFixed(3);
      if (self.syncPercentage > 100) self.syncPercentage = 100;

      p(util.format('status: [%d%%] skipped: %d', self.syncPercentage, self.skippedBlocks));
    }
    if (self.opts.shouldBroadcast) {
      sockets.broadcastSyncInfo(self.info());
    }
  };

  HistoricSync.prototype.getPrevNextBlock = function(blockHash, blockEnd, scanOpts, cb) {
    var self = this;

    // recursion end.
    if (!blockHash) return cb();

    var existed = false;
    var blockInfo;
    var blockObj;

    async.series([
    // Already got it?
    function(c) {
      Block.findOne({
        hash: blockHash
      },
      function(err, block) {
        if (err) {
          p(err);
          return c(err);
        }
        if (block) {
          existed = true;
          blockObj = block;
        }
        return c();
      });
    },
    //show some (inacurate) status
    function(c) {
      if ( ( self.syncedBlocks + self.skippedBlocks)  % self.step === 1) {
        self.showProgress();
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

        if (err && ! existed) return c(err);
        return c();
      });
    },
    /* TODO: Should Start to sync backwards? (this is for partial syncs)
      function(c) {

        if (blockInfo.result.prevblockhash != current.blockHash) {
          p("reorg?");
          scanOpts.prev = 1;
        }
        return c();
        }
      */
    ], function(err) {

      if (err) {
        self.err = util.format('ERROR: @%s: %s [count: syncedBlocks: %d]', blockHash, err, self.syncedBlocks);
        self.status = 'aborted';
        self.showProgress();
        p(self.err);
      }
      else {
        self.err = null;
        self.status = 'syncing';
      }

      if ( (scanOpts.upToExisting && existed && self.syncedBlocks >= self.blockChainHeight) ||
          (blockEnd && blockEnd === blockHash)) {
          self.status = 'finished';
          p('DONE. Found existing block: ', blockHash);
          self.showProgress();
          return cb(err);
      }

      // Continue
      if (blockInfo && blockInfo.result) {

        if (existed)
          self.skippedBlocks++;
        else
          self.syncedBlocks++;

        // recursion
        if (scanOpts.prev && blockInfo.result.previousblockhash)
          return self.getPrevNextBlock(blockInfo.result.previousblockhash, blockEnd, scanOpts, cb);
        
        if (scanOpts.next && blockInfo.result.nextblockhash)
          return self.getPrevNextBlock(blockInfo.result.nextblockhash, blockEnd, scanOpts, cb);
      }
      return cb(err);
    });
  };

  HistoricSync.prototype.importHistory = function(scanOpts, next) {
    var self = this;

    var retry_secs = 2;

    var lastBlock;

    async.series([
    function(cb) {
      if (scanOpts.destroy) {
        p('Deleting DB...');
        return self.sync.destroy(cb);
      }
      return cb();
    },
    // We are not using getBestBlockHash, because is not available in all clients
    function(cb) {
      if (!scanOpts.reverse) return cb();

      self.rpc.getBlockCount(function(err, res) {
        if (err) return cb(err);
        self.blockChainHeight = res.result;
        return cb();
      });
    },
    function(cb) {
      if (!scanOpts.reverse) return cb();

      self.rpc.getBlockHash(self.blockChainHeight, function(err, res) {
        if (err) return cb(err);
        lastBlock = res.result;

        return cb();
      });
    },
    function(cb) {
      if (scanOpts.upToExisting) {
        // should be isOrphan = true or null to be more accurate.
        Block.count({
          isOrphan: null
        },
        function(err, count) {
          if (err) return cb(err);

          self.syncedBlocks =  count || 0;
          return cb();
        });
      }
      else {
          return cb();
      }
    },
    ], function(err) {
      var start, end;
      function sync() {
        if (scanOpts.reverse) {
          start = lastBlock;
          end = self.genesis;
          scanOpts.prev = true;
        }
        else {
          start = self.genesis;
          end = null;
          scanOpts.next = true;
        }
        p('Starting from: ', start);
        p('         to  : ', end);
        p('         scanOpts: ', JSON.stringify(scanOpts));

        self.getPrevNextBlock(start, end, scanOpts, function(err) {
          if (err && err.message.match(/ECONNREFUSED/)) {
            setTimeout(function() {
              p('Retrying in %d secs', retry_secs);
              sync();
            },
            retry_secs * 1000);
          }
          else return next(err);
        });
      }


      if (!self.step) {
        var step = parseInt( (self.blockChainHeight - self.syncedBlocks) / 1000);

        if (self.opts.progressStep) {
          step = self.opts.progressStep;
        }

        if (step < 10) step = 10;
        self.step = step;
      }

      if (err) {
        self.setError(err);
        return next(err, 0);
      }
      else {
        sync();
      }
    });
  };

  // upto if we have genesis block?
  HistoricSync.prototype.smartImport = function(next) {
    var self = this;

    Block.findOne({
      hash: self.genesis
    },
    function(err, b) {

      if (err) return next(err);

      if (!b) {
        p('Could not find Genesis block. Running FULL SYNC');
      }
      else {
        p('Genesis block found. Syncing upto known blocks.');
      }

      var scanOpts = {
        reverse: true,
        upToExisting: b ? true: false,
      };

      return self.importHistory(scanOpts, next);
    });
  };

  return HistoricSync;
}
module.defineClass(spec);

