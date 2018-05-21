import logger from '../../logger';
import { ChainNetwork, Chain } from '../../types/ChainNetwork';
import { HostPort } from '../../types/HostPort';
import { Peer, BitcoreP2pPool } from '../../types/Bitcore-P2P-Pool';
import { Bitcoin } from "../../types/namespaces/Bitcoin";
import { LoggifyClass } from '../../decorators/Loggify';
import { P2pService } from '.';

import { EventEmitter } from 'events';
// import { BlockModel } from '../../models/block';
// import { sleep } from '../../utils/async';
import { Subject } from 'rxjs';
import { ConnectionConfig } from '../../types/BitcoinConfig';

// const cluster = require('cluster');
const Chain = require('../../chain');

@LoggifyClass
export class BtcP2pService extends EventEmitter implements P2pService<Bitcoin.Block, Bitcoin.Transaction> {
  private chain: string;
  private network: string;
  private parentChain: string;
  private forkHeight: number;
  private trustedPeers: HostPort[];
  private syncing: boolean;
  private pool: BitcoreP2pPool;
  private bitcoreLib: any;
  private bitcoreP2p: any;
  private messages: any;
  private invCache: { [key: string]: any[] };
  private stayConnected?: NodeJS.Timer;
  private stream: {
    blocks: Subject<Bitcoin.Block>;
    transactions: Subject<Bitcoin.Transaction>;
  };


  constructor(config: any) {
    super();

    // TODO: manually check if this is true
    const params: ConnectionConfig & ChainNetwork = config;

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
    this.stream = {
      blocks: new Subject(),
      transactions: new Subject(),
    };

    if (!this.bitcoreLib.Networks.get(this.network)) {
      throw new Error('Unknown network specified in config');
    }
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
  }

  public async start() {
    // TODO: what are the semantics of a cluster?
    // if (!cluster.isWorker) {
    await this.connect();
    // }
  }

  private async connect() {
    this.pool.on('peerready', peer => {
      logger.info(`Connected to peer ${peer.host}`, {
        chain: this.chain,
        network: this.network
      });
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
      // TODO: This cache seems slow, maybe it's significant
      const hash = message.transaction.hash;
      if (!this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].includes(hash)) {
        this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].push(hash);
        if (this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].length > 1000) {
          this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].shift();
        }
        this.stream.transactions.next(message.transaction);
      }
    });

    this.pool.on('peerblock', (peer, message) => {
      logger.debug('peer block received', {
        peer,
        chain: this.chain,
        network: this.network,
        message
      });
      // TODO: This cache seems slow, maybe it's significant
      const hash = message.block.hash;
      if (!this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].includes(hash)) {
        this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].push(hash);
        if (this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].length > 1000) {
          this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].shift();
        }
        this.stream.blocks.next(message.block);
        // this.emit(message.block.hash, message.block);
        // if (!this.syncing) {
        //   this.emit('block', message.block);
        //   this.blockQueue.push(message.block);
        // }
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

    // TODO: whats this?
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

    // this.once('ready', async () => {
    //   await BlockModel.handleReorg({ chain: this.chain, network: this.network });
    //   await this.sync();
    // });

    this.stayConnected = setInterval(this.pool.connect.bind(this.pool), 5000);
    this.pool.connect();
  }

  public async stop() {
    if (this.stayConnected) {
      clearInterval(this.stayConnected);
    }
  }

  public async sync(locatorHashes: string[]) {
    // debounce
    if (this.syncing) {
      return;
    }
    this.syncing = true;

    // // check if already synced
    // const bestBlock = await BlockModel.getLocalTip({
    //   chain: this.chain,
    //   network: this.network
    // });
    // if (bestBlock.height === this.getPoolHeight()) {
    //   logger.verbose('Already synced', {
    //     chain: this.chain,
    //     network: this.network,
    //     height: bestBlock.height
    //   });
    //   this.syncing = false;
    //   return;
    // }

    // // if this is forked and origin is not synced,
    // // wait 5 seconds for sync and then try again.
    // while (this.parentChain && bestBlock.height < this.forkHeight) {
    //   const parentBestBlock = await BlockModel.getLocalTip({
    //     chain: this.parentChain,
    //     network: this.network
    //   });
    //   if (parentBestBlock.height < this.forkHeight) {
    //     await sleep(5000);
    //   }
    // }

    // logger.info(
    //   `Syncing from ${bestBlock.height} to ${this.getPoolHeight()} for chain ${
    //     this.chain
    // }`);

    // let blockCounter = 0;
    // let lastLog = 0;

    while (true) {
      const headers = await this.getHeaders(locatorHashes);
      if (headers.length === 0) {
        break;
      }

      for (const header of headers) {
        const block = await this.getBlock(header.hash);
        logger.debug('Block received', block.hash);
        // await this.processBlock(block);
        // blockCounter++;

        // if (Date.now() - lastLog > 100) {
        //   logger.info(`Sync progress ${(
        //     (bestBlock.height + blockCounter) / this.getPoolHeight() * 100
        //   ).toFixed(3)}%`, {
        //     chain: this.chain,
        //     network: this.network,
        //     height: bestBlock.height + blockCounter
        //   });
        //   lastLog = Date.now();
        // }
      }
    }

    logger.info('Sync completed!!', {
      chain: this.chain,
      network: this.network
    });
    this.syncing = false;
  }

  public height(): number {
    return Object.values(this.pool._connectedPeers).reduce(
      (best, peer: Peer) => Math.max(best, peer.bestHeight),
      0
    );
  }

  public parent(): ChainNetwork & { height: number } | undefined {
    if (this.parentChain !== this.chain) {
      return {
        chain: this.parentChain,
        network: this.network,
        height: this.forkHeight,
      };
    }
    return undefined;
  }

  private async getHeaders(candidateHashes: string[]): Promise<Bitcoin.Block.HeaderObj[]> {
    const getHeaders = () => {
      if (this.pool) {
        this.pool.sendMessage(
          this.messages.GetHeaders({
            starts: candidateHashes
          })
        );
      }
    };

    getHeaders();
    const headersRetry = setInterval(getHeaders, 5000);

    return new Promise(resolve =>
      this.once('headers', headers => {
        clearInterval(headersRetry);
        resolve(headers);
      })
    ) as Promise<Bitcoin.Block.HeaderObj[]>;
  }

  private async getBlock(hash: string): Promise<Bitcoin.Block> {
    logger.debug('Getting block, hash:', hash);
    const _getBlock = () => {
      if (this.pool) {
        this.pool.sendMessage(this.messages.GetData.forBlock(hash));
      }
    };

    _getBlock();
    const getBlockRetry = setInterval(_getBlock, 1000);

    return new Promise(resolve =>
      this.once(hash, block => {
        logger.debug('Received block, hash:', hash);
        clearInterval(getBlockRetry);
        resolve(block);
      })
    ) as Promise<Bitcoin.Block>;
  }

  // async processBlock(block: BitcoinBlockType) {
  //   this.blocksDispatch.dispatch({
  //     block: {
  //       chain: this.chain,
  //       network: this.network,
  //       parentChain: this.parentChain,
  //       forkHeight: this.forkHeight,
  //       block
  //     }
  //   });
  //   logger.info(`Added block ${block.hash}`, {
  //     chain: this.chain,
  //     network: this.network
  //   });
  // }

  // processTransaction(tx: BitcoinTransactionType) {
  //   this.transactionsDispatch.dispatch({
  //     transaction: {
  //       txs: [tx],
  //       height: -1,
  //       network: this.network,
  //       chain: this.chain,
  //       blockTime: new Date(),
  //       blockTimeNormalized: new Date()
  //     }
  //   });
  // }

  // sendTransaction(rawTx: { txid: string }) {
  //   if (this.pool) {
  //     this.pool.sendMessage(this.messages.Transaction(rawTx));
  //     return rawTx.txid;
  //   } else {
  //     throw new Error('Cannot broadcast over P2P, not connected to peer pool');
  //   }
  // }

  blocks() {
    return this.stream.blocks;
  }

  transactions() {
    return this.stream.transactions;
  }
}
