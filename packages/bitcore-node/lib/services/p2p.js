const util = require('util');
const cluster = require('cluster');
const {EventEmitter} = require('events');
const Chain = require('../chain');

const mongoose = require('mongoose');
const async = require('async');

const logger = require('../logger');
const Block = mongoose.model('Block');
const Transaction = mongoose.model('Transaction');

const P2pService = function(params) {
  this.chain = params.chain;
  this.parentChain = params.parentChain;
  this.forkHeight = params.forkHeight;
  this.bitcoreLib = Chain[this.chain].lib;
  this.bitcoreP2p = Chain[this.chain].p2p;
  this.network = params.network;
  this.trustedPeers = params.trustedPeers;
  this.invCache = {};
  this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK] = [];
  this.invCache[this.bitcoreP2p.Inventory.TYPE.TX] = [];
  this.headersQueue = [];
  this.blockCache = {};
  this.syncing = false;
  this.blockRates = [];
  this.transactionQueue = async.queue(this.processTransaction.bind(this), 1);
  this.blockQueue = async.queue(this.processBlock.bind(this), 1);

  if (!this.bitcoreLib.Networks.get(this.network)) {
    throw new Error('Unknown network specified in config');
  }
};

util.inherits(P2pService, EventEmitter);

P2pService.prototype.start = function() {
  return new Promise((resolve) => {
    if (cluster.isWorker) {
      return resolve();
    }

    this.connect();
    resolve();
  });
};

P2pService.prototype.connect = function(){
  if (this.network === 'regtest'){
    this.bitcoreLib.Networks.enableRegtest();
  }
  this.messages = new this.bitcoreP2p.Messages({
    network: this.bitcoreLib.Networks.get(this.network)
  });
  this.pool = new this.bitcoreP2p.Pool({
    addrs: this.trustedPeers.map((peer) => {
      return {
        ip: {
          v4: peer.host
        },
        port: peer.port
      };
    }),
    dnsSeed: false,
    listenAddr: false,
    network: this.network,
    messages: this.messages
  });

  this.pool.on('peerready', (peer) => {
    logger.info(`Connected to peer ${peer.host}`, {chain: this.chain, network: this.network});
    this.emit('ready');
  });

  this.pool.on('peerdisconnect', (peer) => {
    logger.warn(`Not connected to peer ${peer.host}`, {chain: this.chain, network: this.network});
  });

  this.pool.on('peertx', (peer, message) => {
    if (!this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].includes(message.transaction.hash)){
      this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].push(message.transaction.hash);
      if (this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].length > 1000) this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].shift();
      this.emit('transaction', message.transaction);
      this.transactionQueue.push(message.transaction);
    }
  });

  this.pool.on('peerblock', (peer, message) => {
    if (!this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].includes(message.block.hash)){
      this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].push(message.block.hash);
      if (this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].length > 1000) this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].shift();
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
        let hash = this.bitcoreLib.encoding.BufferReader(inv.hash).readReverse().toString('hex');
        return !this.invCache[inv.type].includes(hash);
      });
      if (filtered.length){
        peer.sendMessage(this.messages.GetData(filtered));
      }
    }
  });

  this.once('ready', () => {
    Block.handleReorg({chain: this.chain, network: this.network}, () => {
      this.sync();
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

P2pService.prototype.sync = async function(done) {
  var self = this;
  done = done || function() {};
  if (this.syncing){
    return done();
  }
  this.syncing = true;
  let bestBlock = await Block.getLocalTip({ chain: this.chain, network: this.network });
  if (bestBlock.height === this.getPoolHeight()) {
    logger.verbose('Already synced', { chain: this.chain, network: this.network, height: bestBlock.height });
    self.syncing = false;
    return done();
  }
  if (this.parentChain && bestBlock.height < this.forkHeight){
    let parentBestBlock = await Block.getLocalTip({ chain: this.parentChain, network: this.network });
    if (parentBestBlock.height < this.forkHeight) {
      return setTimeout(this.sync.bind(this), 5000);
    }
  }
  logger.info(`Syncing from ${bestBlock.height} to ${self.getPoolHeight()} for chain ${self.chain}`);
  let blockCounter = 0;
  async.during(
    function (cb) {
      self.getHeaders(function (err, headers) {
        logger.verbose(`Received ${headers.length} headers`);
        self.headersQueue = headers;
        cb(err, headers.length);
      });
    },
    function (cb) {
      let lastLog = 0;
      async.eachOfSeries(self.headersQueue, function (header, headerIndex, cb) {
        self.getBlock(header.hash, function (err, block) {
          Block.addBlock({ block, chain: self.chain, network: self.network, parentChain: self.parentChain, forkHeight: self.forkHeight }, function (err) {
            blockCounter++;
            if (Date.now() - lastLog > 100) {
              logger.info(`Sync progress ${((bestBlock.height + blockCounter) / self.getPoolHeight() * 100).toFixed(3)}%`, {
                chain: self.chain,
                network: self.network,
                height: bestBlock.height + blockCounter
              });
              lastLog = Date.now();
            }
            cb(err);
          });
        });
      }, function (err) {
        cb(err);
      });
    },
    function (err) {
      if (err) {
        logger.error(err);
        self.sync();
      } else {
        logger.info('Sync completed!!', { chain: self.chain, network: self.network });
        self.syncing = false;
      }
    }
  );
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
  Block.getLocatorHashes({chain: this.chain, network: this.network}, (err, locatorHashes) => {
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
  Block.addBlock({chain: this.chain, network: this.network, block}, (err) => {
    if(err){
      logger.error(err);
    } else {
      logger.info(`Added block ${block.hash}`, {chain: this.chain, network: this.network});
    }
    callback(err);
  });
};

P2pService.prototype.processTransaction = async function(tx) {
  return Transaction.batchImport({
    txs: [tx],
    height: -1,
    network: this.network,
    chain: this.chain,
    blockTime: new Date(),
    blockTimeNormalized: new Date()
  });
};

P2pService.prototype.sendTransaction = async function(rawTx) {
  this.pool.sendMessage(this.messages.Transaction(rawTx));
  return rawTx.txid;
};


module.exports = P2pService;
