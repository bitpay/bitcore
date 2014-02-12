'use strict';

require('classtool');



function spec() {
  var util = require('util');
  var RpcClient = require('bitcore/RpcClient').class();
  var bitutil = require('bitcore/util/util');
  var Address = require('bitcore/Address').class();
  var Script = require('bitcore/Script').class();
  var networks = require('bitcore/networks');
  var async = require('async');
  var config = require('../config/config');
  var Sync = require('./Sync').class();
  var sockets = require('../app/controllers/socket.js');
  var BlockExtractor = require('./BlockExtractor.js').class();
	//var Deserialize = require('bitcore/Deserialize');


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
    this.updatePercentage();
    return {
      status: this.status,
      blockChainHeight: this.blockChainHeight,
      syncPercentage: this.syncPercentage,
      skippedBlocks: this.skippedBlocks,
      syncedBlocks: this.syncedBlocks,
      orphanBlocks: this.orphanBlocks,
      syncTipHash: this.sync.tip,
      error: this.error,
      type: this.type,
    };
  };

  HistoricSync.prototype.updatePercentage = function() {
    var r = (this.syncedBlocks + this.skippedBlocks) / this.blockChainHeight;
    this.syncPercentage = parseFloat(100 * r).toFixed(3);
    if (this.syncPercentage > 100) this.syncPercentage = 100;
  };

  HistoricSync.prototype.showProgress = function() {
    var self = this;

    if ( ( self.syncedBlocks + self.skippedBlocks)  % self.step !== 1)  return;

    if (self.error) {
      p('ERROR: ' +  self.error);
    }
    else {
      p(util.format('status: [%d%%] skipped: %d ', self.syncPercentage, self.skippedBlocks));
    }
    if (self.opts.shouldBroadcastSync) {
      sockets.broadcastSyncInfo(self.info());
    }

//TODO
// if (self.syncPercentage > 10) {
//   process.exit(-1);
// }
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

      if ( (scanOpts.upToExisting && existed &&
            self.syncedBlocks >= self.blockChainHeight) ||
          (blockEnd && blockEnd === blockHash)) {
          self.status = 'finished';
          p('DONE. Found block: ', blockHash);
          self.showProgress();
          return cb(err);
      }

      // Continue
      if (blockInfo) {

        if (existed)
          self.skippedBlocks++;
        else
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


  // TODO. replace with 
  // Script.prototype.getAddrStrs if that one get merged in bitcore
  HistoricSync.prototype.getAddrStr = function(s) {
    var self = this;

    var addrStrs = [];
    var type = s.classify();
    var addr;

    switch(type) {
      case Script.TX_PUBKEY:
        var chunk = s.captureOne();
        addr = new Address(self.network.addressPubkey, bitutil.sha256ripe160(chunk));
        addrStrs = [ addr.toString() ];
        break;
      case  Script.TX_PUBKEYHASH:
        addr = new Address(self.network.addressPubkey, s.captureOne());
        addrStrs = [ addr.toString() ];
        break;
      case Script.TX_SCRIPTHASH:
        addr = new Address(self.network.addressScript, s.captureOne());
        addrStrs = [ addr.toString() ];
        break;
      case Script.TX_MULTISIG:
        var chunks = s.capture();
        chunks.forEach(function(chunk) {
          var a = new Address(self.network.addressPubkey,  bitutil.sha256ripe160(chunk));
          addrStrs.push(a.toString());
        });
        break;
      case Script.TX_UNKNOWN:
        break;
    }

    return addrStrs;
  };

  HistoricSync.prototype.getBlockFromFile = function(cb) {
    var self = this;

    var blockInfo;

    //get Info
    self.blockExtractor.getNextBlock(function(err, b) {
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
          var addrs = self.getAddrStr(s);

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
        if (blockInfo && blockInfo.hash) {
          self.syncedBlocks++;
        } else
          self.status = 'finished';

        if (err) {
          self.setError(util.format('ERROR: @%s: %s [count: syncedBlocks: %d]',
                                    blockInfo ? blockInfo.hash : '-', err, self.syncedBlocks));
        }
        return cb(err);
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


  HistoricSync.prototype.getBlockCount = function(cb) {
    var self = this;

    if (self.blockChainHeight) return cb();

    self.rpc.getBlockCount(function(err, res) {
      if (err) return cb(err);
      self.blockChainHeight = res.result;
      return cb();
    });
  };

  HistoricSync.prototype.importHistory = function(scanOpts, next) {
    var self = this;

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
    function (cb) { return self.getBlockCount(cb); },
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
        self.countNotOrphan(function(err, count) {
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
      if (err) {
        self.setError(err);
        return next(err, 0);
      }


      // SETUP Sync params
      var start, end;

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
          return next(err);
        });
      }
      else {
        self.type = 'from RPC calls';
        self.getPrevNextBlock(start, end, scanOpts, function(err) {
          return next(err);
        });
      }

    });
  };

  // upto if we have genesis block?
  HistoricSync.prototype.smartImport = function(scanOpts, next) {
    var self = this;

    self.sync.bDb.has(self.genesis, function(err, b) {
      if (err) return next(err);
      self.countNotOrphan(function(err, count) {
        if (err) return next(err);
          self.getBlockCount(function(err) {
            if (err) return next(err);

            if (!b || scanOpts.destroy || count < self.blockChainHeight * 0.8 ) {

              if (!b)
                p('Could not find Genesis block. Running FULL SYNC');
              else
                p('Less that 80% of current blockchain is stored. Running FULL SYNC',
                  parseInt(count/self.blockChainHeight*100));

              if (config.bitcoind.dataDir) {
                p('bitcoind dataDir configured...importing blocks from .dat files');
                scanOpts.fromFiles = true;
                self.blockExtractor = new BlockExtractor(config.bitcoind.dataDir, config.network);
              }
              else {
                scanOpts.reverse = true;
              }
            }
            else {
              p('Genesis block found. Syncing upto known blocks.');
              p('Got ' + count + ' out of ' + self.blockChainHeight + ' blocks');
              scanOpts.reverse = true;
              scanOpts.upToExisting = true;
            }
            return self.importHistory(scanOpts, next);
        });
      });
    });
  };

  return HistoricSync;
}
module.defineClass(spec);

