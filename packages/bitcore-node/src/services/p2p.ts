import logger from '../logger';
import { ConnectionConfig } from '../types/BitcoinConfig';
import { ChainNetwork } from '../types/ChainNetwork';
import { EventEmitter } from 'events';
import { HostPort } from '../types/HostPort';
import { Peer, BitcoreP2pPool } from '../types/Bitcore-P2P-Pool';
import { BlockModel } from '../models/block';
import { TransactionModel } from '../models/transaction';
import { LoggifyClass } from '../decorators/Loggify';
import { Bitcoin } from "../types/namespaces/Bitcoin";
import { sleep } from '../utils/async';
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
  syncing: boolean;
  blockRates: any[];
  transactionQueue: any[];
  blockQueue: any[];
  messages: any;
  pool: undefined | BitcoreP2pPool;

  stayConnected: undefined | NodeJS.Timer;

  constructor(params: ChainNetwork & ConnectionConfig) {
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
    this.syncing = false;
    this.blockRates = [];
    this.transactionQueue = async.queue(this.processTransaction.bind(this), 1);
    this.blockQueue = async.queue(this.processBlock.bind(this), 1);

    if (!this.bitcoreLib.Networks.get(this.network)) {
      throw new Error('Unknown network specified in config');
    }
  }

  async start() {
    if (!cluster.isWorker) {
      await this.connect();
    }
  }

  async connect() {
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
          const filtered = message.inventory.filter((inv: any) => {
            const hash = this.bitcoreLib.encoding
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

      this.once('ready', async () => {
        await BlockModel.handleReorg({ chain: this.chain, network: this.network });
        await this.sync();
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

  async sync() {
    // debounce
    if (this.syncing) {
      return;
    }
    this.syncing = true;

    // check if already synced
    const bestBlock = await BlockModel.getLocalTip({
      chain: this.chain,
      network: this.network
    });
    if (bestBlock.height === this.getPoolHeight()) {
      logger.verbose('Already synced', {
        chain: this.chain,
        network: this.network,
        height: bestBlock.height
      });
      this.syncing = false;
      return;
    }

    // if this is forked and origin is not synced,
    // wait 5 seconds for sync and then try again.
    while (this.parentChain && bestBlock.height < this.forkHeight) {
      const parentBestBlock = await BlockModel.getLocalTip({
        chain: this.parentChain,
        network: this.network
      });
      if (parentBestBlock.height < this.forkHeight) {
        await sleep(5000);
      }
    }

    logger.info(
      `Syncing from ${bestBlock.height} to ${this.getPoolHeight()} for chain ${
        this.chain
    }`);

    let blockCounter = 0;
    let lastLog = 0;

    while (true) {
      const headers = await this.getHeaders();
      if (headers.length === 0) {
        break;
      }

      for (const header of headers) {
        const block = await this.getBlock(header.hash);
        logger.debug('Block received', block.hash);
        await this.processBlock(block);
        blockCounter++;

        if (Date.now() - lastLog > 100) {
          logger.info(`Sync progress ${(
            (bestBlock.height + blockCounter) / this.getPoolHeight() * 100
          ).toFixed(3)}%`, {
            chain: this.chain,
            network: this.network,
            height: bestBlock.height + blockCounter
          });
          lastLog = Date.now();
        }
      }
    }

    logger.info('Sync completed!!', {
      chain: this.chain,
      network: this.network
    });
    this.syncing = false;
  }

  getPoolHeight(): number {
    if (this.pool) {
      return Object.values(this.pool._connectedPeers).reduce(
        (best, peer: Peer) => Math.max(best, peer.bestHeight),
        0
      );
    }
    throw 'Pool cannot be undefined';
  }

  async _getHeaders(candidateHashes: string[]): Promise<Bitcoin.Block.HeaderObj[]> {
    const getHeaders = () => {
      if (this.pool) {
        this.pool.sendMessage(this.messages.GetHeaders({
          starts: candidateHashes
        }));
      }
    };

    getHeaders();
    const headersRetry = setInterval(getHeaders, 5000);

    return new Promise(resolve => this.once('headers', headers => {
      clearInterval(headersRetry);
      resolve(headers)
    })) as Promise<Bitcoin.Block.HeaderObj[]>;
  }

  async getHeaders(): Promise<Bitcoin.Block.HeaderObj[]> {
    const locatorHashes = await BlockModel.getLocatorHashes({
      chain: this.chain,
      network: this.network
    });
    logger.debug(`Getting headers with ${locatorHashes.length} locatorHashes`);

    const headers = await this._getHeaders(locatorHashes);
    logger.debug(`Received ${headers.length} headers`);
    return headers;
  }

  async getBlock(hash: string): Promise<Bitcoin.Block> {
    logger.debug('Getting block, hash:', hash);
    const _getBlock = () => {
      if (this.pool) {
        this.pool.sendMessage(this.messages.GetData.forBlock(hash));
      }
    };

    _getBlock();
    const getBlockRetry = setInterval(_getBlock, 1000);

    return new Promise(resolve => this.once(hash, block => {
      logger.debug('Received block, hash:', hash);
      clearInterval(getBlockRetry);
      resolve(block)
    })) as Promise<Bitcoin.Block>;
  }

  async processBlock(block: Bitcoin.Block) {
    await BlockModel.addBlock({
      chain: this.chain,
      network: this.network,
      parentChain: this.parentChain,
      forkHeight: this.forkHeight,
      block
    });
    logger.info(`Added block ${block.hash}`, {
      chain: this.chain,
      network: this.network
    });
  }

  processTransaction(tx: Bitcoin.Transaction) {
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
    if (this.pool) {
      this.pool.sendMessage(this.messages.Transaction(rawTx));
      return rawTx.txid;
    } else {
      throw new Error('Cannot broadcast over P2P, not connected to peer pool');
    }
  }
}
