import logger from '../logger';
import { EventEmitter } from 'events';
import { BlockStorage, BlockModel } from '../models/block';
import { ChainStateProvider } from '../providers/chain-state';
import { TransactionStorage } from '../models/transaction';
import { Bitcoin } from '../types/namespaces/Bitcoin';
import { StateStorage } from '../models/state';
import { SpentHeightIndicators } from '../types/Coin';
import os from 'os';
import { Config, ConfigService } from './config';
const Chain = require('../chain');
const LRU = require('lru-cache');

export class P2pManager {
  workers = new Array<P2pWorker>();

  private configService: ConfigService;

  constructor({ configService = Config } = {}) {
    this.configService = configService;
  }

  async stop() {
    logger.info('Stopping P2P Manager');
    for (const worker of this.workers) {
      await worker.stop();
    }
  }

  async start({ blockModel = BlockStorage } = {}) {
    if (this.configService.isDisabled('p2p')) {
      logger.info('Disabled P2P Manager');
      return;
    }
    logger.info('Starting P2P Manager');
    const p2pWorkers = new Array<P2pWorker>();
    for (let chainNetwork of Config.chainNetworks()) {
      const { chain, network } = chainNetwork;
      const chainConfig = Config.chainConfig(chainNetwork);
      if (chainConfig.chainSource && chainConfig.chainSource !== 'p2p') {
        continue;
      }
      const p2pWorker = new P2pWorker({
        chain,
        network,
        chainConfig,
        blockModel
      });
      p2pWorkers.push(p2pWorker);
      try {
        p2pWorker.start();
      } catch (e) {
        logger.error('P2P Worker died with', e);
      }
    }
  }
}

export class P2pWorker {
  private chain: string;
  private network: string;
  private bitcoreLib: any;
  private bitcoreP2p: any;
  private chainConfig: any;
  private events: EventEmitter;
  private syncing: boolean;
  private messages: any;
  private pool: any;
  private connectInterval?: NodeJS.Timer;
  private invCache: any;
  private initialSyncComplete: boolean;
  private isSyncingNode: boolean;
  private syncingNodeHeartBeat?: NodeJS.Timer;
  private blockModel: BlockModel;
  constructor({ chain, network, chainConfig, blockModel = BlockStorage }) {
    this.blockModel = blockModel;
    this.chain = chain;
    this.network = network;
    this.bitcoreLib = Chain[this.chain].lib;
    this.bitcoreP2p = Chain[this.chain].p2p;
    this.chainConfig = chainConfig;
    this.events = new EventEmitter();
    this.syncing = false;
    this.initialSyncComplete = false;
    this.isSyncingNode = false;
    this.invCache = new LRU({ max: 10000 });
    this.messages = new this.bitcoreP2p.Messages({
      network: this.bitcoreLib.Networks.get(this.network)
    });
    this.pool = new this.bitcoreP2p.Pool({
      addrs: this.chainConfig.trustedPeers.map(peer => {
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

  setupListeners() {
    this.pool.on('peerready', peer => {
      logger.info(`Connected to peer ${peer.host}`, {
        chain: this.chain,
        network: this.network
      });
    });

    this.pool.on('peerdisconnect', peer => {
      logger.warn(`Not connected to peer ${peer.host}`, {
        chain: this.chain,
        network: this.network,
        port: peer.port
      });
    });

    this.pool.on('peertx', (peer, message) => {
      const hash = message.transaction.hash;
      logger.debug('peer tx received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        hash
      });
      if (this.isSyncingNode && !this.invCache.get(hash)) {
        this.processTransaction(message.transaction);
        this.events.emit('transaction', message.transaction);
      }
      this.invCache.set(hash);
    });

    this.pool.on('peerblock', async (peer, message) => {
      const { block } = message;
      const { hash } = block;
      logger.debug('peer block received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        hash
      });

      if (this.isSyncingNode && !this.invCache.get(hash)) {
        this.invCache.set(hash);
        this.events.emit(hash, message.block);
        this.events.emit('block', message.block);
        this.sync();
      }
    });

    this.pool.on('peerheaders', (peer, message) => {
      logger.debug('peerheaders message received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        count: message.headers.length
      });
      this.events.emit('headers', message.headers);
    });

    this.pool.on('peerinv', (peer, message) => {
      if (this.isSyncingNode && !this.syncing) {
        const filtered = message.inventory.filter(inv => {
          const hash = this.bitcoreLib.encoding
            .BufferReader(inv.hash)
            .readReverse()
            .toString('hex');
          return !this.invCache.get(hash);
        });

        if (filtered.length) {
          peer.sendMessage(this.messages.GetData(filtered));
        }
      }
    });
  }

  async connect() {
    this.pool.connect();
    this.connectInterval = setInterval(this.pool.connect.bind(this.pool), 5000);
    return new Promise<void>(resolve => {
      this.pool.once('peerready', () => resolve());
    });
  }

  async disconnect() {
    this.pool.removeAllListeners();
    this.pool.disconnect();
    if (this.connectInterval) {
      clearInterval(this.connectInterval);
    }
  }

  public async getHeaders(candidateHashes: string[]): Promise<Bitcoin.Block.HeaderObj[]> {
    return new Promise<Bitcoin.Block.HeaderObj[]>(resolve => {
      const _getHeaders = () => {
        this.pool.sendMessage(
          this.messages.GetHeaders({
            starts: candidateHashes
          })
        );
      };
      const headersRetry = setInterval(_getHeaders, 1000);

      this.events.once('headers', headers => {
        clearInterval(headersRetry);
        resolve(headers);
      });
      _getHeaders();
    });
  }

  public async getBlock(hash: string) {
    return new Promise(resolve => {
      logger.debug('Getting block, hash:', hash);
      const _getBlock = () => {
        this.pool.sendMessage(this.messages.GetData.forBlock(hash));
      };
      const getBlockRetry = setInterval(_getBlock, 1000);

      this.events.once(hash, block => {
        logger.debug('Received block, hash:', hash);
        clearInterval(getBlockRetry);
        resolve(block);
      });
      _getBlock();
    });
  }

  getBestPoolHeight(): number {
    let best = 0;
    for (const peer of Object.values(this.pool._connectedPeers) as { bestHeight: number }[]) {
      if (peer.bestHeight > best) {
        best = peer.bestHeight;
      }
    }
    return best;
  }

  async processBlock(block): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.blockModel.addBlock({
          chain: this.chain,
          network: this.network,
          forkHeight: this.chainConfig.forkHeight,
          parentChain: this.chainConfig.parentChain,
          initialSyncComplete: this.initialSyncComplete,
          block
        });
        if (!this.syncing) {
          logger.info(`Added block ${block.hash}`, {
            chain: this.chain,
            network: this.network
          });
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async processTransaction(tx: Bitcoin.Transaction): Promise<any> {
    const now = new Date();
    TransactionStorage.batchImport({
      chain: this.chain,
      network: this.network,
      txs: [tx],
      height: SpentHeightIndicators.pending,
      mempoolTime: now,
      blockTime: now,
      blockTimeNormalized: now,
      initialSyncComplete: true
    });
  }

  async sync() {
    if (this.syncing) {
      return;
    }
    this.syncing = true;
    const { chain, chainConfig, network } = this;
    const { parentChain, forkHeight } = chainConfig;
    const state = await StateStorage.collection.findOne({});
    this.initialSyncComplete =
      state && state.initialSyncComplete && state.initialSyncComplete.includes(`${chain}:${network}`);
    let tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (parentChain && (!tip || tip.height < forkHeight)) {
      let parentTip = await ChainStateProvider.getLocalTip({ chain: parentChain, network });
      while (!parentTip || parentTip.height < forkHeight) {
        logger.info(`Waiting until ${parentChain} syncs before ${chain} ${network}`);
        await new Promise(resolve => {
          setTimeout(resolve, 5000);
        });
        parentTip = await ChainStateProvider.getLocalTip({ chain: parentChain, network });
      }
    }

    const getHeaders = async () => {
      const locators = await ChainStateProvider.getLocatorHashes({ chain, network });
      return this.getHeaders(locators);
    };

    let headers = await getHeaders();
    while (headers.length > 0) {
      tip = await ChainStateProvider.getLocalTip({ chain, network });
      let currentHeight = tip ? tip.height : 0;
      let lastLog = 0;
      logger.info(`Syncing ${headers.length} blocks for ${chain} ${network}`);
      for (const header of headers) {
        try {
          const block = await this.getBlock(header.hash);
          await this.processBlock(block);
          currentHeight++;
          if (Date.now() - lastLog > 100) {
            logger.info(`Sync `, {
              chain,
              network,
              height: currentHeight
            });
            lastLog = Date.now();
          }
        } catch (err) {
          logger.error(`Error syncing ${chain} ${network}`, err);
          this.syncing = false;
          return this.sync();
        }
      }
      headers = await getHeaders();
    }
    logger.info(`${chain}:${network} up to date.`);
    this.syncing = false;
    StateStorage.collection.findOneAndUpdate(
      {},
      { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
      { upsert: true }
    );
    return true;
  }

  registerSyncingNode() {
    this.syncingNodeHeartBeat = setInterval(async () => {
      const syncingNode = await StateStorage.getSyncingNode({ chain: this.chain, network: this.network });
      if (!syncingNode) {
        return StateStorage.selfNominateSyncingNode({
          chain: this.chain,
          network: this.network,
          lastHeartBeat: syncingNode
        });
      }
      const [hostname, pid] = syncingNode.split(':');
      const amSyncingNode = hostname === os.hostname() && pid === process.pid.toString();
      if (amSyncingNode) {
        StateStorage.selfNominateSyncingNode({ chain: this.chain, network: this.network, lastHeartBeat: syncingNode });
        if (!this.isSyncingNode) {
          logger.info(`This worker is now the syncing node for ${this.chain} ${this.network}`);
          this.isSyncingNode = true;
          this.sync();
        }
      } else {
        setTimeout(() => {
          StateStorage.selfNominateSyncingNode({
            chain: this.chain,
            network: this.network,
            lastHeartBeat: syncingNode
          });
        }, 10000);
      }
    }, 500);
  }

  async stop() {
    logger.debug(`Stopping worker for chain ${this.chain}`);
    await this.disconnect();
    if (this.syncingNodeHeartBeat) {
      clearInterval(this.syncingNodeHeartBeat);
    }
  }

  async start() {
    logger.debug(`Started worker for chain ${this.chain}`);
    this.setupListeners();
    await this.connect();
    this.registerSyncingNode();
  }
}

export const P2P = new P2pManager();
