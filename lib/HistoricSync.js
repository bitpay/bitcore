'use strict';

require('classtool');



function spec() {
  var util = require('util');
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
    this.orphanBlocks = 0;
    this.type ='';
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
    if (self.opts.shouldBroadcastSync) {
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

        self.startTs = parseInt(Date.now());

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
    this.updatePercentage();
    return {
      status: this.status,
      blockChainHeight: this.blockChainHeight,
      syncPercentage: this.syncPercentage,
      syncedBlocks: this.syncedBlocks,
      orphanBlocks: this.orphanBlocks,
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

  HistoricSync.prototype.getPrevNextBlock = function(blockHash, blockEnd, scanOpts, cb) {
    var self = this;

    // recursion end.
    if (!blockHash) return cb();

    var existed = false;
    var blockInfo;

    async.series([
    // Already got it?
    function(c) {
      self.sync.bDb.has(blockHash, function(err, ret) {
        if (err) {
          p(err);
          return c(err);
        }

        if (ret) existed = true;
        return c();
      });
    },
    //show some (inacurate) status
    function(c) {
      self.showProgress();
      return c();
    },

    function(c) {
      self.rpc.getBlock(blockHash, function(err, ret) {
        if (err) return c(err);
        if (ret) {
          blockInfo = ret.result;
          // this is to match block retreived from file
          if (blockInfo.hash === self.genesis)
            blockInfo.previousblockhash = self.network.genesisBlock.prev_hash.toString('hex');
        }
        else {
          blockInfo = null;
        }

        return c();
      });
    },
    //store it
    function(c) {
      if (existed) return c();

      // When storing files from RPC recusively, reorgs are disabled
      self.sync.storeTipBlock(blockInfo, false, function(err) {
        return c(err);
      });
    }], function(err) {

      if (err) {
        self.setError(util.format('ERROR: @%s: %s [count: syncedBlocks: %d]',
                                  blockHash, err, self.syncedBlocks));
        return cb(err);
      }
      else {
        self.status = 'syncing';
      }

      if ( blockEnd && blockEnd === blockHash) {
        p('blockEnd found!:' + blockEnd);
        self.found=1;
      }

      if ( self.found && self.syncedBlocks >= self.blockChainHeight ) {

          self.endTs = parseInt(Date.now());
          self.status = 'finished';
          p('DONE. Height: ' , self.syncedBlocks);
          return cb(err);
      }

      // Continue
      if (blockInfo) {

        self.syncedBlocks++;

        // recursion
        if (scanOpts.prev && blockInfo.previousblockhash)
          return self.getPrevNextBlock(blockInfo.previousblockhash, blockEnd, scanOpts, cb);
        
        if (scanOpts.next && blockInfo.nextblockhash)
          return self.getPrevNextBlock(blockInfo.nextblockhash, blockEnd, scanOpts, cb);
      }
      return cb(err);
    });
  };


//var a=1;
  HistoricSync.prototype.getBlockFromFile = function(cb) {
    var self = this;

    var blockInfo;

    //get Info
    self.blockExtractor.getNextBlock(function(err, b) {
//      a++;
//return cb(null,{previousblockhash:a.toString(), hash:(a-1).toString() });
      if (err || ! b) return cb(err);
      blockInfo = b.getStandardizedObject(b.txs, self.network);
      // blockInfo.curWork = Deserialize.intFromCompact(b.bits);
      // We keep the RPC field names
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

      return cb(err,blockInfo);
    });
  };


  HistoricSync.prototype.nextBlockFromFile = function(scanOpts, cb) {
    var self = this;

    self.showProgress();
    self.getBlockFromFile(function(err, blockInfo) {
      if (err) {
        self.setError(util.format('ERROR: @%s: %s [count: syncedBlocks: %d]',
                                  blockInfo ? blockInfo.hash : '-', err, self.syncedBlocks));
        return cb(err);
      }

      self.sync.storeTipBlock(blockInfo, function(err) {
        if (err) {
          self.setError(util.format('ERROR: @%s: %s [count: syncedBlocks: %d]',
                                    blockInfo ? blockInfo.hash : '-', err, self.syncedBlocks));
          return cb(err);
        }

        self.sync.bDb.setLastFileIndex(self.blockExtractor.currentFileIndex, function(err) {
          if (err) return cb(err);

          if (blockInfo && blockInfo.hash) {
            self.syncedBlocks++;
          }
          else {
            self.endTs = parseInt(Date.now());
            self.status = 'finished';
          }

          return cb(err);
        });
      });
    });
  };


  HistoricSync.prototype.countNotOrphan = function(cb) {
    var self = this;

    if (self.notOrphanCount) return cb(null, self.notOrphanCount);


    self.sync.bDb.countNotOrphan(function(err, count) {
      if (err) return cb(err);
      self.notOrphanCount = count;
      return cb(null, self.notOrphanCount);
    });
  };


  HistoricSync.prototype.updateBlockCount = function(cb) {
    var self = this;

    if (self.blockChainHeight) return cb();

    self.rpc.getBlockCount(function(err, res) {
      if (err) return cb(err);
      self.blockChainHeight = res.result;
      return cb();
    });
  };

  HistoricSync.prototype.smartImport = function(scanOpts, next) {
    var self = this;

    var genesis, count;
    var lastBlock;
    var tip;

    async.series([
      function(s_c) {
        if (!scanOpts.destroy) return s_c();
        
        p('Deleting DB...');
        return self.sync.destroy(s_c);
      },
      function(s_c) {
        self.sync.bDb.has(self.genesis, function(err, b) {
          genesis = b;
          return s_c(err);
        });
      },
      function(s_c) {
        self.countNotOrphan(function(err, c) {
          count = c;
          return s_c(err);
        });
      },
      function(s_c) {
        if (!config.bitcoind.dataDir) return s_c();
        if (scanOpts.startFile) {
          self.blockExtractor = new BlockExtractor(config.bitcoind.dataDir, config.network);
          self.blockExtractor.currentFileIndex = scanOpts.startFile;
          return s_c();
        }
        self.sync.bDb.getLastFileIndex(function(err, idx) {
          self.blockExtractor = new BlockExtractor(config.bitcoind.dataDir, config.network);
          if (idx) self.blockExtractor.currentFileIndex = idx;
          return s_c(err);
        });
      },
      function(s_c) {
        self.updateBlockCount(s_c);
      },

      // define sync strategy
      function(s_c) {
        if (!genesis || scanOpts.destroy || count < self.blockChainHeight * 0.9 ) {

          // Full sync.
          if (!genesis)
            p('Could not find Genesis block. Running FULL SYNC');
          else
            p('Less that 90% of current blockchain is stored. Running FULL SYNC',
                parseInt(count/self.blockChainHeight*100));

          if (config.bitcoind.dataDir) {
            p('bitcoind dataDir configured...importing blocks from .dat files');
            p('Starting from file: ' + self.blockExtractor.currentFileIndex);
            scanOpts.fromFiles = true;
          }
          else {
            scanOpts.reverse = true;
          }
        }
        else {
          p('Genesis block found. Syncing upto old TIP.');
          p('Got ' + count + ' out of ' + self.blockChainHeight + ' blocks');
          scanOpts.reverse = true;
        }

        if (!scanOpts.reverse) return s_c();

        self.rpc.getBlockHash(self.blockChainHeight, function(err, res) {
          if (err) return s_c(err);
          lastBlock = res.result;
          return s_c();
        });
      },
      function(s_c) {
        if (!scanOpts.reverse) return s_c();
        self.sync.bDb.getTip(function(err, res) {
          if (err) return s_c(err);
          tip = res;

          console.log('Old Tip:', tip);
          return s_c();
        });
      },
      function(s_c) {
        if (!scanOpts.reverse) return s_c();
        self.countNotOrphan(function(err, count) {
          if (err) return s_c(err);

          self.syncedBlocks =  count || 0;
          return s_c();
        });
      }],
      function(err) {
      // SETUP Sync params
      var start, end;
      if (err) {
        self.setError(err);
        return next(err, 0);
      }

      if (!self.step) {
        var step = parseInt( (self.blockChainHeight - self.syncedBlocks) / 1000);

        if (self.opts.progressStep) {
          step = self.opts.progressStep;
        }

        if (step < 10) step = 10;
        self.step = step;
      }

      if (scanOpts.reverse) {
        start = lastBlock;
        end   = tip || self.genesis;
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

      if (scanOpts.fromFiles) {

        self.status = 'syncing';
        self.type   = 'from .dat Files';


        async.whilst(function() {
          return self.status === 'syncing';
        }, function (w_cb) {
          self.nextBlockFromFile(scanOpts, function(err) {
            setImmediate(function(){
              return w_cb(err);
            });
          });
        }, function(err) {
          self.showProgress();
          return next(err);
        });
      }
      else {
        self.type = 'from RPC calls';
        self.getPrevNextBlock(start, end, scanOpts, function(err) {
          self.showProgress();
          return next(err);
        });
      }
    });
  };

  return HistoricSync;
}
module.defineClass(spec);

