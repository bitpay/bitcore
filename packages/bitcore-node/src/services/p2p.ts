import logger from '../logger';
import { BitcoinConnectionConfig } from '../types/BitcoinConfig';
import { ChainNetwork } from '../types/ChainNetwork';
import { EventEmitter } from 'events';
import { HostPort } from '../types/HostPort';
import { Peer, BitcoreP2pPool } from '../types/Bitcore-P2P-Pool';
import { CallbackType } from '../types/Callback';
import { BitcoinBlockType, BlockHeader, BlockHeaderObj } from '../types/Block';
import { BitcoinTransactionType } from '../types/Transaction';
import { BlockModel } from '../models/block';
import { TransactionModel } from '../models/transaction';
import { LoggifyClass } from '../decorators/Loggify';
const cluster = require('cluster');
const Chain = require('../chain');
const async = require('async');

@LoggifyClass
export class P2pService extends EventEmitter {
  chain: string;
  network: string;
  parentChain: string;
  forkHeight: number;
  bitcoreLib: any;
  bitcoreP2p: any;
  trustedPeers: Array<HostPort>;
  invCache: { [key: string]: any[] };
  headersQueue: any[];
  syncing: boolean;
  blockRates: any[];
  transactionQueue: any[];
  blockQueue: any[];
  messages: any;
  pool: undefined | BitcoreP2pPool;

  stayConnected: undefined | NodeJS.Timer;

  constructor(params: ChainNetwork & BitcoinConnectionConfig) {
    super();
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
    this.syncing = false;
    this.blockRates = [];
    this.transactionQueue = async.queue(this.processTransaction.bind(this), 1);
    this.blockQueue = async.queue(this.processBlock.bind(this), 1);

    if (!this.bitcoreLib.Networks.get(this.network)) {
      throw new Error('Unknown network specified in config');
    }
  }

  start() {
    return new Promise(resolve => {
      if (cluster.isWorker) {
        return resolve();
      }

      this.connect();
      resolve();
    });
  }

  connect() {
    if (this.network === 'regtest') {
      this.bitcoreLib.Networks.enableRegtest();
    }
    this.messages = new this.bitcoreP2p.Messages({
      network: this.bitcoreLib.Networks.get(this.network)
    });
    this.pool = new this.bitcoreP2p.Pool({
      addrs: this.trustedPeers.map(peer => {
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

    if (this.pool != null) {
      this.pool.on('peerready', peer => {
        logger.info(`Connected to peer ${peer.host}`, {
          chain: this.chain,
          network: this.network
        });
        this.emit('ready');
      });

      this.pool.on('peerdisconnect', peer => {
        logger.warn(`Not connected to peer ${peer.host}`, {
          chain: this.chain,
          network: this.network
        });
      });

      this.pool.on('peertx', (peer, message) => {
        logger.debug('peer tx received', {
          peer,
          chain: this.chain,
          network: this.network,
          message
        });
        if (
          !this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].includes(
            message.transaction.hash
          )
        ) {
          this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].push(
            message.transaction.hash
          );
          if (this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].length > 1000)
            this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].shift();
          this.emit('transaction', message.transaction);
          this.transactionQueue.push(message.transaction);
        }
      });

      this.pool.on('peerblock', (peer, message) => {
        logger.debug('peer block received', {
          peer,
          chain: this.chain,
          network: this.network,
          message
        });
        if (
          !this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].includes(
            message.block.hash
          )
        ) {
          this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].push(
            message.block.hash
          );
          if (this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].length > 1000)
            this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].shift();
          this.emit(message.block.hash, message.block);
          if (!this.syncing) {
            this.emit('block', message.block);
            this.blockQueue.push(message.block);
          }
        }
      });

      this.pool.on('peerheaders', (peer, message) => {
        logger.debug('peerheaders message received', {
          peer,
          chain: this.chain,
          network: this.network,
          message
        });
        this.emit('headers', message.headers);
      });

      this.pool.on('peerinv', (peer, message) => {
        if (!this.syncing) {
          let filtered = message.inventory.filter((inv: any) => {
            let hash = this.bitcoreLib.encoding
              .BufferReader(inv.hash)
              .readReverse()
              .toString('hex');
            return !this.invCache[inv.type].includes(hash);
          });
          if (filtered.length) {
            peer.sendMessage(this.messages.GetData(filtered));
          }
        }
      });

      this.once('ready', () => {
        BlockModel.handleReorg(
          { chain: this.chain, network: this.network },
          () => {
            this.sync();
          }
        );
      });

      this.stayConnected = setInterval(() => {
        if (this.pool) {
          this.pool.connect();
        }
      }, 5000);

      this.pool.connect();
    }
  }

  stop() {
    if (this.stayConnected) {
      clearInterval(this.stayConnected);
    }
  }

  async sync(done?: CallbackType) {
    var self = this;
    done = done || function() {};
    if (this.syncing) {
      return done();
    }
    this.syncing = true;
    let bestBlock = await BlockModel.getLocalTip({
      chain: this.chain,
      network: this.network
    });
    if (bestBlock.height === this.getPoolHeight()) {
      logger.verbose('Already synced', {
        chain: this.chain,
        network: this.network,
        height: bestBlock.height
      });
      self.syncing = false;
      return done();
    }
    if (this.parentChain && bestBlock.height < this.forkHeight) {
      let parentBestBlock = await BlockModel.getLocalTip({
        chain: this.parentChain,
        network: this.network
      });
      if (parentBestBlock.height < this.forkHeight) {
        return setTimeout(this.sync.bind(this), 5000);
      }
    }
    logger.info(
      `Syncing from ${bestBlock.height} to ${self.getPoolHeight()} for chain ${
        self.chain
      }`
    );
    let blockCounter = 0;
    async.during(
      function(cb: CallbackType) {
        self.getHeaders(function(err: any, headers: any[]) {
          if (err) {
            logger.error(err);
          }
          self.headersQueue = headers;
          cb(err, headers.length > 0);
        });
      },
      function(cb: CallbackType) {
        let lastLog = 0;
        async.eachSeries(
          self.headersQueue,
          function(
            header: BlockHeaderObj,
            cb: CallbackType
          ) {
            self.getBlock(header.hash, function(
              err: any,
              block: BitcoinBlockType
            ) {
              if (err) {
                return cb(err);
              }
              logger.debug('Block received', block.hash);
              self.processBlock(block, function(err: any) {
                blockCounter++;
                if (Date.now() - lastLog > 100) {
                  logger.info(
                    `Sync progress ${(
                      (bestBlock.height + blockCounter) /
                      self.getPoolHeight() *
                      100
                    ).toFixed(3)}%`,
                    {
                      chain: self.chain,
                      network: self.network,
                      height: bestBlock.height + blockCounter
                    }
                  );
                  lastLog = Date.now();
                }
                cb(err);
              });
            });
          },
          function(err: any) {
            cb(err);
          }
        );
      },
      function(err: any) {
        if (err) {
          logger.warn(err);
          self.sync();
        } else {
          logger.info('Sync completed!!', {
            chain: self.chain,
            network: self.network
          });
          self.syncing = false;
        }
      }
    );
  }

  getPoolHeight(): number {
    if (this.pool != undefined) {
      return Object.values(this.pool._connectedPeers).reduce(
        (best, peer: Peer) => {
          return Math.max(best, peer.bestHeight);
        },
        0
      );
    }
    throw 'Pool cannot be undefined';
  }

  _getHeaders(candidateHashes: string[], callback: CallbackType) {
    let getHeaders = () => {
      if (this.pool != undefined) {
        this.pool.sendMessage(
          this.messages.GetHeaders({ starts: candidateHashes })
        );
      }
    };
    let headersRetry = setInterval(() => {
      getHeaders();
    }, 5000);
    this.once('headers', headers => {
      clearInterval(headersRetry);
      callback(null, headers);
    });
    getHeaders();
  }

  getHeaders(callback: CallbackType) {
    BlockModel.getLocatorHashes(
      { chain: this.chain, network: this.network },
      (err: any, locatorHashes: string[]) => {
        if (err) {
          logger.error(err);
          return callback(err);
        }
        logger.debug(
          `Getting headers with ${locatorHashes.length} locatorHashes`
        );
        this._getHeaders(locatorHashes, (err, headers: BlockHeader[]) => {
          logger.debug(`Received ${headers.length} headers`);
          if (err) {
            return callback(err);
          }
          callback(null, headers);
        });
      }
    );
  }

  getBlock(hash: string, callback: CallbackType) {
    logger.debug('Getting block, hash:', hash);
    let getBlock = () => {
      if (this.pool !== undefined) {
        this.pool.sendMessage(this.messages.GetData.forBlock(hash));
      }
    };
    let getBlockRetry = setInterval(() => {
      getBlock();
    }, 1000);
    this.once(hash, block => {
      logger.debug('Received block, hash:', hash);
      clearInterval(getBlockRetry);
      callback && callback(null, block);
    });
    getBlock();
  }

  processBlock(block: BitcoinBlockType, callback: CallbackType) {
    BlockModel.addBlock(
      {
        chain: this.chain,
        network: this.network,
        parentChain: this.parentChain,
        forkHeight: this.forkHeight,
        block
      },
      (err: any) => {
        if (err) {
          logger.error(err);
        } else {
          logger.info(`Added block ${block.hash}`, {
            chain: this.chain,
            network: this.network
          });
        }
        callback(err);
      }
    );
  }

  processTransaction(tx: BitcoinTransactionType) {
    return TransactionModel.batchImport({
      txs: [tx],
      height: -1,
      network: this.network,
      chain: this.chain,
      blockTime: new Date(),
      blockTimeNormalized: new Date()
    });
  }

  sendTransaction(rawTx: { txid: string }) {
    if (this.pool != undefined) {
      this.pool.sendMessage(this.messages.Transaction(rawTx));
      return rawTx.txid;
    } else
      throw new Error('Cannot broadcast over P2P, not connected to peer pool');
  }
}
