import logger from '../../logger';
import { HostPort } from '../../types/HostPort';
import { Peer, BitcoreP2pPool } from '../../types/Bitcore-P2P-Pool';
import { Bitcoin } from "../../types/namespaces/Bitcoin";
import { LoggifyClass } from '../../decorators/Loggify';
import { P2pService } from '.';

import { EventEmitter } from 'events';
import { Subject } from 'rxjs';
import { Cache } from '../../utils/cache';

const Chain = require('../../chain');

@LoggifyClass
export class BtcP2pService extends EventEmitter implements P2pService<Bitcoin.Block, Bitcoin.Transaction> {
  public syncing: boolean;

  private chain: string;
  private network: string;
  private forked?: {
    chain: string;
    height: number;
  };
  private trustedPeers: HostPort[];
  private pool: BitcoreP2pPool;
  private bitcoreLib: any;
  private bitcoreP2p: any;
  private messages: any;
  private invCache: { [key: string]: Cache };
  private stayConnected?: NodeJS.Timer;
  private stream: {
    blocks: Subject<{
      block: Bitcoin.Block,
      transactions: Bitcoin.Transaction[]
    }>;
    transactions: Subject<Bitcoin.Transaction>;
  };


  constructor(config: any) {
    super();

    // Chain
    if (typeof config.chain === 'string') {
      this.chain = config.chain;
    }
    else {
      throw new Error(`BtcP2pService: chain must be a string, got ${config.chain}`);
    }

    // Network
    if (typeof config.network === 'string') {
      this.network = config.network;
    }
    else {
      throw new Error(`BtcP2pService: network must be a string, got ${config.network}`);
    }

    // Parent Chain
    if (config.parentChain) {
      let chain;
      if (typeof config.parentChain === 'string') {
        chain = config.parentChain;
      }
      else {
        throw new Error(`BtcP2pService: parentChain must be a string, got ${config.parentChain}`);
      }

      // Fork Height
      let height;
      if (typeof config.forkHeight === 'number') {
        height = config.forkHeight;
      }
      else {
        throw new Error(`BtcP2pService: forkHeight must be a number, got ${config.forkHeight}`);
      }
      this.forked = {
        chain,
        height,
      };
    }
    else if (config.forkHeight) {
      throw new Error(`BtcP2pService: must provide forkHeight if providing parentChain`);
    }

    // Peers
    this.trustedPeers = [];
    if (config.trustedPeers instanceof Array && config.trustedPeers.length > 0) {
      for (const peer of config.trustedPeers) {
        if (typeof peer.host === 'string' && typeof peer.port === 'number') {
          this.trustedPeers.push(peer);
        }
        else {
          throw new Error(`BtcP2pService: peer must be { host: string, port: number }, got ${peer}`);
        }
      }
    }
    else {
      throw new Error(`BtcP2pService: trustedPeers must be a non-empty list, got ${config.trustedPeers}`);
    }

    this.bitcoreLib = Chain[this.chain].lib;
    this.bitcoreP2p = Chain[this.chain].p2p;
    this.invCache = {
      [this.bitcoreP2p.Inventory.TYPE.BLOCK]: new Cache(1000),
      [this.bitcoreP2p.Inventory.TYPE.TX]: new Cache(1000),
    };
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
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        transaction: message.transaction.hash,
      });
      const hash = message.transaction.hash;
      if (!this.invCache[this.bitcoreP2p.Inventory.TYPE.TX].use(hash)) {
        this.stream.transactions.next(message.transaction);
      }
    });

    this.pool.on('peerblock', (peer, message) => {
      logger.debug('peer block received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        block: message.block.hash
      });
      const hash = message.block.hash;

      if (!this.invCache[this.bitcoreP2p.Inventory.TYPE.BLOCK].use(hash)) {
        this.emit(hash, message.block);
        if (!this.syncing) {
          this.stream.blocks.next({
            block: message.block,
            transactions: message.block.transactions
          });
        }
      }
    });

    this.pool.on('peerheaders', (peer, message) => {
      logger.debug('peerheaders message received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        headers: message.headers.map(h => h.hash),
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
          return !this.invCache[inv.type].peek(hash);
        });
        if (filtered.length) {
          peer.sendMessage(this.messages.GetData(filtered));
        }
      }
    });

    this.stayConnected = setInterval(this.pool.connect.bind(this.pool), 5000);
    this.pool.connect();

    // connect to peers before using this service
    return new Promise<void>(resolve => {
      this.pool.once('peerready', () => resolve())
    });
  }

  public async stop() {
    if (this.stayConnected) {
      clearInterval(this.stayConnected);
    }
  }

  public async sync(locatorHashes: string[]): Promise<string | undefined> {
    const headers = await this.getHeaders(locatorHashes);
    let lastHash: string | undefined = undefined;

    for (const header of headers) {
      const block = await this.getBlock(header.hash);
      logger.debug('Block received', block.hash);
      this.stream.blocks.next({
        block,
        transactions: block.transactions
      });
      lastHash = block.hash;
    }
    return lastHash;
  }

  public height(): number {
    return Object.values(this.pool._connectedPeers).reduce(
      (best, peer: Peer) => Math.max(best, peer.bestHeight),
      0
    );
  }

  public parent(): {
    chain: string,
    network: string,
    height: number,
  } | undefined {
    if (this.forked && this.forked.chain !== this.chain) {
      return {
        chain: this.forked.chain,
        network: this.network,
        height: this.forked.height,
      };
    }
    return undefined;
  }

  private async getHeaders(candidateHashes: string[]): Promise<Bitcoin.Block.HeaderObj[]> {
    return new Promise(resolve => {
      const getHeaders = () => {
        this.pool.sendMessage(this.messages.GetHeaders({
          starts: candidateHashes
        }));
      };
      const headersRetry = setInterval(getHeaders, 5000);

      this.once('headers', headers => {
        clearInterval(headersRetry);
        resolve(headers);
      });
      getHeaders();
    }) as Promise<Bitcoin.Block.HeaderObj[]>;
  }

  private async getBlock(hash: string): Promise<Bitcoin.Block> {
    return new Promise(resolve => {
      logger.debug('Getting block, hash:', hash);
      const _getBlock = () => {
        this.pool.sendMessage(this.messages.GetData.forBlock(hash));
      };
      const getBlockRetry = setInterval(_getBlock, 1000);

      this.once(hash, block => {
        logger.debug('Received block, hash:', hash);
        clearInterval(getBlockRetry);
        resolve(block);
      });
      _getBlock();
    }) as Promise<Bitcoin.Block>;
  }

  blocks() {
    return this.stream.blocks;
  }

  transactions() {
    return this.stream.transactions;
  }
}
