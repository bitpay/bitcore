const util = require('util');
const cluster = require('cluster');
const {EventEmitter} = require('events');
const bitcore = require('bitcore-lib');
const { Inventory, Pool, Messages } = require('bitcore-p2p');

const mongoose = require('mongoose');
const async = require('async');
const ProgressBar = require('progress');

const config = require('../config');
const Block = mongoose.model('Block');
const Transaction = mongoose.model('Transaction');

const P2pService = function(params={}) {
  this.chain = params.chain;
  this.network = params.network;
  this.invCache = {};
  this.invCache[Inventory.TYPE.BLOCK] = [];
  this.invCache[Inventory.TYPE.TX] = [];
  this.headersQueue = [];
  this.blockCache = {};
  this.syncing = false;
  this.blockRates = [];
  this.transactionQueue = async.queue(this.processTransaction.bind(this), 1);
  this.blockQueue = async.queue(this.processBlock.bind(this), 1);

};

util.inherits(P2pService, EventEmitter);

P2pService.prototype.start = function(ready) {
  if(config.chainSource !== 'p2p') {
    return setImmediate(ready);
  }
  if(cluster.isWorker) {
    return setImmediate(ready);
  }

  this.connect(ready);
};

P2pService.prototype.connect = function(ready){
  this.messages = new Messages({
    network: bitcore.Networks.get(config.network)
  });
  this.pool = new Pool({
    addrs: config.trustedPeers.map((peer) => {
      return {
        ip: {
          v4: peer.host
        },
        port: peer.port
      };
    }),
    dnsSeed: false,
    listenAddr: false,
    network: config.network,
    messages: this.messages
  });

  this.pool.on('peerready', (peer) => {
    console.log(`Connected to peer ${peer.host}`);
    this.emit('ready');
  });

  this.pool.on('peerdisconnect', (peer) => {
    console.log(`Not connected to peer ${peer.host}`);
  });

  this.pool.on('peertx', (peer, message) => {
    if (!this.invCache[Inventory.TYPE.TX].includes(message.transaction.hash)){
      this.invCache[Inventory.TYPE.TX].push(message.transaction.hash);
      if (this.invCache[Inventory.TYPE.TX].length > 1000) this.invCache[Inventory.TYPE.TX].shift();
      this.emit('transaction', message.transaction);
      this.transactionQueue.push(message.transaction);
    }
  });

  this.pool.on('peerblock', (peer, message) => {
    if (!this.invCache[Inventory.TYPE.BLOCK].includes(message.block.hash)){
      this.invCache[Inventory.TYPE.BLOCK].push(message.block.hash);
      if (this.invCache[Inventory.TYPE.BLOCK].length > 1000) this.invCache[Inventory.TYPE.BLOCK].shift();
      this.emit(message.block.hash, message.block);
      if (!this.syncing) {
        this.emit('block', message.block);
        this.blockQueue.push(message.block);
      }
    }
  });

  this.pool.on('peerheaders', (peer, message) => {
    this.emit('headers', message.headers);
  });

  this.pool.on('peerinv', (peer, message) => {
    if (!this.syncing){
      let filtered = message.inventory.filter((inv) => {
        let hash = bitcore.encoding.BufferReader(inv.hash).readReverse().toString('hex');
        return !this.invCache[inv.type].includes(hash);
      });
      if (filtered.length){
        peer.sendMessage(this.messages.GetData(filtered));
      }
    }
  });

  this.once('ready', () => {
    Block.handleReorg(null, () => {
      this.sync();
      ready();
    });
  });

  this.stayConnected = setInterval(() =>{
    this.pool.connect();
  }, 5000);

  this.pool.connect();
};

P2pService.prototype.stop = function() {
  clearInterval(this.stayConnected);
};

P2pService.prototype.sync = function(done) {
  var self = this;
  done = done || function() {};
  if (this.syncing){
    return done();
  }
  this.syncing = true;
  Block.getLocalTip(function(err, bestBlock) {
    if(bestBlock.height === self.getPoolHeight()) {
      self.syncing = false;
      return done();
    }
    var counter = 0;
    var bar = new ProgressBar('syncing [:bar] :percent :blockRate s/block :blocksEta hrs :blockTime :current', {
      curr: bestBlock.height,
      complete: '=',
      incomplete: ' ',
      width: 30,
      total: self.getPoolHeight(),
      renderThrottle: 500
    });

    async.during(
      function(cb) {
        self.getHeaders(function(err, headers) {
          self.headersQueue = headers;
          cb(err, headers.length);
        });
      },
      function(cb) {
        async.eachOfSeries(self.headersQueue, function(header, headerIndex, cb) {
          var start = Date.now();
          self.getBlock(header.hash, function(err, block) {
            Block.addBlock(block, function(err) {
              var end = Date.now();
              counter++;
              self.blockRates.push(((end - start) / 1000));
              if(self.blockRates.length > 144) {
                self.blockRates.shift();
              }
              var avgBlockRate = self.blockRates.reduce(function(p, c, i, a) {return p + (c / a.length);}, 0);
              bar.tick({
                blockTime: new Date(block.header.time * 1000).toISOString(),
                blockRate: avgBlockRate.toFixed(2),
                blocksEta: ((((self.getPoolHeight() - bestBlock.height) - counter) * avgBlockRate) / 3600).toFixed(2)
              });
              cb(err);
            });
          });
        }, function(err) {
          cb(err);
        });
      },
      function(err) {
        if(err) {
          console.error(err);
          self.sync();
        } else {
          console.log('Sync completed!!');
          self.syncing = false;
        }
      }
    );
  });
};

P2pService.prototype.getPoolHeight = function() {
  return Object.values(this.pool._connectedPeers).reduce((best, peer) => { return Math.max(best, peer.bestHeight); }, 0);
};

P2pService.prototype._getHeaders = function(candidateHashes, callback) {
  let getHeaders = () => {
    this.pool.sendMessage(this.messages.GetHeaders({ starts: candidateHashes }));
  };
  let headersRetry = setInterval(()=> {
    getHeaders();
  }, 5000);
  this.once('headers', (headers) => {
    clearInterval(headersRetry);
    callback(null, headers);
  });
  getHeaders();
};

P2pService.prototype.getHeaders = function(callback) {
  Block.getLocatorHashes((err, locatorHashes) => {
    if(err) {
      return callback(err);
    }
    this._getHeaders(locatorHashes, (err, headers) => {
      if(err) {
        return callback(err);
      }
      callback(null, headers);
    });
  });
};

P2pService.prototype.getBlock = function(hash, callback) {
  let getBlock = () => {
    this.pool.sendMessage(this.messages.GetData.forBlock(hash));
  };
  let getBlockRetry = setInterval(() =>{
    getBlock();
  }, 1000);
  this.once(hash, (block) => {
    clearInterval(getBlockRetry);
    callback && callback(null, block);
  });
  getBlock();
};

P2pService.prototype.processBlock = function(block, callback) {
  Block.addBlock(block, function(err) {
    if(err){
      console.error(err);
    } else {
      console.log('Added block:\t' + block.rhash());
    }
    callback(err);
  });
};

P2pService.prototype.processTransaction = async function(tx) {
  console.log(`Adding tx: ${tx.hash}`);
  return Transaction.batchImport({
    txs: [tx],
    height: -1,
    network: config.network,
    blockTime: new Date(),
    blockTimeNormalized: new Date()
  });
};


module.exports = new P2pService();
