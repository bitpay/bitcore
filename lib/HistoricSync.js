'use strict';

require('classtool');



function spec() {
  var util = require('util');
  var assert = require('assert');
  var RpcClient = require('bitcore/RpcClient').class();
  var Script = require('bitcore/Script').class();
  var networks = require('bitcore/networks');
  var async = require('async');
  var config = require('../config/config');
  var Sync = require('./Sync').class();
  var sockets = require('../app/controllers/socket.js');
  var BlockExtractor = require('./BlockExtractor.js').class();
  //  var bitcoreUtil = require('bitcore/util/util');
	//  var Deserialize = require('bitcore/Deserialize');


  var BAD_GEN_ERROR = 'Bad genesis block. Network mismatch between Insight and bitcoind? Insight is configured for:';

  var BAD_GEN_ERROR_DB = 'Bad genesis block. Network mismatch between Insight and levelDB? Insight is configured for:';
  function HistoricSync(opts) {
    opts = opts || {};

    this.network = config.network === 'testnet' ? networks.testnet: networks.livenet;

    var genesisHashReversed = new Buffer(32);
    this.network.genesisBlock.hash.copy(genesisHashReversed);
    this.genesis = genesisHashReversed.reverse().toString('hex');

    this.rpc = new RpcClient(config.bitcoind);
    this.shouldBroadcast = opts.shouldBroadcastSync;
    this.sync = new Sync(opts);
  }

  function p() {
    var args = [];
    Array.prototype.push.apply(args, arguments);

    args.unshift('[historic_sync]');
    /*jshint validthis:true */
    console.log.apply(this, args);
  }

  HistoricSync.prototype.showProgress = function() {
    var self = this;

    if ( self.status ==='syncing' &&
        ( self.syncedBlocks )  % self.step !== 1)  return;

    if (self.error) {
      p('ERROR: ' +  self.error);
    }
    else {
      self.updatePercentage();
      p(util.format('status: [%d%%]', self.syncPercentage));
    }
    if (self.shouldBroadcast) {
      sockets.broadcastSyncInfo(self.info());
    }

 // if (self.syncPercentage > 10) {
 //   process.exit(-1);
 // }
  };


  HistoricSync.prototype.setError = function(err) {
    var self = this;
    self.error = err.toString();
    self.status='error';
    self.showProgress();
    return err;
  };



  HistoricSync.prototype.close = function() {
    this.sync.close();
  };


  HistoricSync.prototype.info = function() {
    this.updatePercentage();
    return {
      status: this.status,
      blockChainHeight: this.blockChainHeight,
      syncPercentage: this.syncPercentage,
      syncedBlocks: this.syncedBlocks,
      syncTipHash: this.sync.tip,
      error: this.error,
      type: this.type,
      startTs: this.startTs,
      endTs: this.endTs,
    };
  };

  HistoricSync.prototype.updatePercentage = function() {
    var r = this.syncedBlocks  / this.blockChainHeight;
    this.syncPercentage = parseFloat(100 * r).toFixed(3);
    if (this.syncPercentage > 100) this.syncPercentage = 100;
  };

  HistoricSync.prototype.getBlockFromRPC = function(cb) {
    var self = this;

    if (!self.currentRpcHash) return cb();

    var blockInfo;
    self.rpc.getBlock(self.currentRpcHash, function(err, ret) {
      if (err) return cb(err);
      if (ret) {
        blockInfo = ret.result;
        // this is to match block retreived from file
        if (blockInfo.hash === self.genesis)
          blockInfo.previousblockhash =
            self.network.genesisBlock.prev_hash.toString('hex');

        self.currentRpcHash = blockInfo.nextblockhash;
      }
      else {
        blockInfo = null;
      }
      return cb(null, blockInfo);
    });
  };

  HistoricSync.prototype.getBlockFromFile = function(cb) {
    var self = this;

    var blockInfo;

    //get Info
    self.blockExtractor.getNextBlock(function(err, b) {
      if (err || ! b) return cb(err);
      blockInfo = b.getStandardizedObject(b.txs, self.network);
      blockInfo.previousblockhash = blockInfo.prev_block;

      var ti=0;
      // Get TX Address
      b.txs.forEach(function(t) {


        var objTx = blockInfo.tx[ti++];

        //add time from block
        objTx.time = blockInfo.time;

        var to=0;
        t.outs.forEach( function(o) {


          var s = new Script(o.s);
          var addrs = self.sync.txDb.getAddrStr(s);

          // support only for p2pubkey p2pubkeyhash and p2sh
          if (addrs.length === 1) {
            objTx.out[to].addrStr = addrs[0];
          }
          to++;
        });
      });
      self.sync.bDb.setLastFileIndex(self.blockExtractor.currentFileIndex, function(err) {
        return cb(err,blockInfo);
      });
    });
  };

  HistoricSync.prototype.updateConnectedCountDB = function(cb) {
    var self = this;
    self.sync.bDb.countConnected(function(err, count) {
      self.connectedCountDB = count  || 0;
      self.syncedBlocks     =  count || 0;
      return cb(err);
    });
  };


  HistoricSync.prototype.updateBlockChainHeight = function(cb) {
    var self = this;

    self.rpc.getBlockCount(function(err, res) {
      self.blockChainHeight = res.result;
      return cb(err);
    });
  };


  HistoricSync.prototype.checkNetworkSettings = function(next) {
    var self = this;

    self.hasGenesis = false;

    // check network config
    self.rpc.getBlockHash(0, function(err, res){
      if (!err && ( res && res.result !== self.genesis)) {
        err = new Error(BAD_GEN_ERROR + config.network);
      }
      if (err) return next(err);
      self.sync.bDb.has(self.genesis, function(err, b) {
        if (!err && ( res && res.result !== self.genesis)) {
          err = new Error(BAD_GEN_ERROR_DB + config.network);
        }
        self.hasGenesis = b?true:false;
        return next(err);
      });
    });
  };

  HistoricSync.prototype.updateStartBlock = function(next) {
    var self = this;

    self.startBlock = self.genesis;

    self.sync.bDb.getTip(function(err,tip) {
      if (!tip) return next();

      var blockInfo;
      var oldtip;

      //check that the tip is still on the mainchain
      async.doWhilst(
        function(cb) {
          self.sync.bDb.fromHashWithInfo(tip, function(err, bi) {
            blockInfo = bi ? bi.info : {};
            if (oldtip)
              self.sync.setBlockMain(oldtip, false, cb);
            else
              return cb();
          });
        },
        function(err) {
          if (err) return next(err);
          var ret = false;
          if ( self.blockChainHeight  === blockInfo.height ||
              blockInfo.confirmations > 0) {
            ret = false;
          }
          else {
            oldtip = tip;
            tip = blockInfo.previousblockhash;
            assert(tip);
            p('Previous TIP is now orphan. Back to:' + tip);
            ret  = true;
          }
          return ret;
        },
        function(err) {
          self.startBlock = tip;
          p('Resuming sync from block:'+tip);
          return next(err);
        }
      );
    });
  };

  HistoricSync.prototype.prepareFileSync = function(opts, next) {
    var self = this;

    if ( opts.forceRPC || !config.bitcoind.dataDir ||
      self.connectedCountDB > self.blockChainHeight * 0.9) return next();


    self.blockExtractor = new BlockExtractor(config.bitcoind.dataDir, config.network);

    self.getFn = self.getBlockFromFile;
    self.allowReorgs = true;
    self.sync.bDb.getLastFileIndex(function(err, idx) {
      if (opts.forceStartFile)
        self.blockExtractor.currentFileIndex = opts.forceStartFile;
      else if (idx) self.blockExtractor.currentFileIndex = idx;

      var h = self.genesis;

      p('Seeking file to:' + self.startBlock);
      //forward till startBlock
      async.whilst(
        function() {
          return h !== self.startBlock;
        },
        function (w_cb) {
          self.getBlockFromFile(function(err,b) {
            h=b.hash;
            setImmediate(function(){
              return w_cb(err);
            });
          });
        }, next);
    });
  };

  //NOP
  HistoricSync.prototype.prepareRpcSync = function(opts, next) {
    var self = this;

    if (self.blockExtractor) return next();
    self.getFn = self.getBlockFromRPC;
    self.currentRpcHash  = self.startBlock;
    self.allowReorgs = false;
    return next();
  };

  HistoricSync.prototype.showSyncStartMessage = function() {
    var self = this;

    p('Got ' + self.connectedCountDB +
      ' blocks in current DB, out of ' + self.blockChainHeight + ' block at bitcoind');

    if (self.blockExtractor) {
      p('bitcoind dataDir configured...importing blocks from .dat files');
      p('First file index: ' + self.blockExtractor.currentFileIndex);
    }
    else {
      p('syncing from RPC (slow)');
    }

    p('Starting from: ', self.startBlock);
    self.showProgress();
  };


  HistoricSync.prototype.setupSyncStatus = function() {
    var self = this;

    var step = parseInt( (self.blockChainHeight - self.syncedBlocks) / 1000);
    if (step < 10) step = 10;

    self.step = step;
    self.type   = self.blockExtractor?'from .dat Files':'from RPC calls';
    self.status = 'syncing';
    self.startTs = Date.now();
    self.endTs   = null;
    this.error  = null;
    this.syncPercentage = 0;
  };

  HistoricSync.prototype.prepareToSync = function(opts, next) {
    var self = this;

    self.status = 'starting';
    async.series([
      function(s_c) {
        self.checkNetworkSettings(s_c);
      },
      function(s_c) {
        self.updateConnectedCountDB(s_c);
      },
      function(s_c) {
        self.updateBlockChainHeight(s_c);
      },
      function(s_c) {
        self.updateStartBlock(s_c);
      },
      function(s_c) {
        self.prepareFileSync(opts, s_c);
      },
      function(s_c) {
        self.prepareRpcSync(opts, s_c);
      },
    ],
    function(err) {
      if (err)  return(self.setError(err));

      self.showSyncStartMessage();
      self.setupSyncStatus();
      return next();
    });
  };

       
  HistoricSync.prototype.start = function(opts, next) {
    var self = this;

    if (self.status==='starting' || self.status==='syncing') {
      p('## Wont start to sync while status is %s', self.status);
      return next();
    }

    self.prepareToSync(opts, function(err) {
      if (err) return next(self.setError(err));

      async.whilst(
        function() {
          return self.status === 'syncing';
        },
        function (w_cb) {
          self.getFn(function(err,blockInfo) {
            if (err) return w_cb(self.setError(err));

            self.showProgress();
            if (blockInfo && blockInfo.hash) {
              self.syncedBlocks++;
              self.sync.storeTipBlock(blockInfo, self.allowReorgs, function(err) {
                if (err) return w_cb(self.setError(err));

                self.sync.bDb.setTip(blockInfo.hash, function(err) {
                  if (err) return w_cb(self.setError(err));

                  setImmediate(function(){
                    return w_cb(err);
                  });
                });
              });
            }
            else {
              self.endTs = Date.now();
              self.status = 'finished';
              return w_cb(err);
            }
          });
        }, next);
    });
  };
  return HistoricSync;
}
module.defineClass(spec);

