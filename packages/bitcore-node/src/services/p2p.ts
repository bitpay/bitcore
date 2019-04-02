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
import { wait } from '../utils/wait';
const Chain = require('../chain');

export class P2pManager {
  workers = new Array<P2pWorker>();

  private configService: ConfigService;
  private p2pWorkers: Array<P2pWorker>;

  constructor({ configService = Config } = {}) {
    this.configService = configService;
    this.p2pWorkers = new Array<P2pWorker>();
  }

  async stop() {
    logger.info('Stopping P2P Manager');
    for (const worker of this.p2pWorkers) {
      await worker.stop();
    }
  }

  async start({ blockModel = BlockStorage } = {}) {
    if (this.configService.isDisabled('p2p')) {
      logger.info('Disabled P2P Manager');
      return;
    }
    logger.info('Starting P2P Manager');

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
      this.p2pWorkers.push(p2pWorker);
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
  private isSyncing: boolean;
  private messages: any;
  private pool: any;
  private connectInterval?: NodeJS.Timer;
  private invCache: any;
  private invCacheLimits: any;
  private initialSyncComplete: boolean;
  private stopping?: boolean;
  private blockModel: BlockModel;
  private lastHeartBeat: string;
  private queuedRegistrations: Array<NodeJS.Timer>;
  constructor({ chain, network, chainConfig, blockModel = BlockStorage }) {
    this.blockModel = blockModel;
    this.chain = chain;
    this.network = network;
    this.bitcoreLib = Chain[this.chain].lib;
    this.bitcoreP2p = Chain[this.chain].p2p;
    this.chainConfig = chainConfig;
    this.events = new EventEmitter();
    this.isSyncing = false;
    this.lastHeartBeat = '';
    this.queuedRegistrations = [];
    this.initialSyncComplete = false;
    this.invCache = {};
    this.invCacheLimits = {
      [this.bitcoreP2p.Inventory.TYPE.BLOCK]: 100,
      [this.bitcoreP2p.Inventory.TYPE.TX]: 100000
    };
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

  cacheInv(type: number, hash: string): void {
    if (!this.invCache[type]) {
      this.invCache[type] = [];
    }
    if (this.invCache[type].length > this.invCacheLimits[type]) {
      this.invCache[type].shift();
    }
    this.invCache[type].push(hash);
  }

  isCachedInv(type: number, hash: string): boolean {
    if (!this.invCache[type]) {
      this.invCache[type] = [];
    }
    return this.invCache[type].includes(hash);
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
      if (this.isSyncingNode && !this.isCachedInv(this.bitcoreP2p.Inventory.TYPE.TX, hash) && !this.isSyncing) {
        this.cacheInv(this.bitcoreP2p.Inventory.TYPE.TX, hash);
        this.processTransaction(message.transaction);
        this.events.emit('transaction', message.transaction);
      }
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

      const blockInCache = this.isCachedInv(this.bitcoreP2p.Inventory.TYPE.BLOCK, hash);
      if (!blockInCache) {
        this.cacheInv(this.bitcoreP2p.Inventory.TYPE.BLOCK, hash);
      }
      if (this.isSyncingNode && (!blockInCache || this.isSyncing)) {
        this.events.emit(hash, message.block);
        this.events.emit('block', message.block);
        if (!this.isSyncing) {
          this.sync();
        }
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
      if (this.isSyncingNode && !this.isSyncing) {
        const filtered = message.inventory.filter(inv => {
          const hash = this.bitcoreLib.encoding
            .BufferReader(inv.hash)
            .readReverse()
            .toString('hex');
          return !this.isCachedInv(inv.type, hash);
        });

        if (filtered.length) {
          peer.sendMessage(this.messages.GetData(filtered));
        }
      }
    });
  }

  async connect() {
    this.setupListeners();
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
    let received = false;
    return new Promise<Bitcoin.Block.HeaderObj[]>(async resolve => {
      this.events.once('headers', headers => {
        received = true;
        resolve(headers);
      });
      while (!received) {
        this.pool.sendMessage(this.messages.GetHeaders({ starts: candidateHashes }));
        await wait(1000);
      }
    });
  }

  public async getBlock(hash: string) {
    logger.debug('Getting block, hash:', hash);
    let received = false;
    return new Promise<Bitcoin.Block>(async resolve => {
      this.events.once(hash, block => {
        logger.debug('Received block, hash:', hash);
        received = true;
        resolve(block);
      });
      while (!received) {
        this.pool.sendMessage(this.messages.GetData.forBlock(hash));
        await wait(1000);
      }
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
    await this.blockModel.addBlock({
      chain: this.chain,
      network: this.network,
      forkHeight: this.chainConfig.forkHeight,
      parentChain: this.chainConfig.parentChain,
      initialSyncComplete: this.initialSyncComplete,
      block
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

  async syncDone() {
    return new Promise(resolve => this.events.once('SYNCDONE', resolve));
  }

  async sync() {
    if (this.isSyncing) {
      return false;
    }
    this.isSyncing = true;
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
        await wait(5000);
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
          this.isSyncing = false;
          return this.sync();
        }
      }
      headers = await getHeaders();
    }
    logger.info(`${chain}:${network} up to date.`);
    this.isSyncing = false;
    await StateStorage.collection.findOneAndUpdate(
      {},
      { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
      { upsert: true }
    );
    this.events.emit('SYNCDONE');
    return true;
  }

  async resync(from: number, to: number) {
    const { chain, network } = this;
    let currentHeight = Math.max(1, from);
    const originalSyncValue = this.isSyncing;
    while (currentHeight < to) {
      this.isSyncing = true;
      const locatorHashes = await ChainStateProvider.getLocatorHashes({
        chain,
        network,
        startHeight: Math.max(1, currentHeight - 30),
        endHeight: currentHeight
      });
      const headers = await this.getHeaders(locatorHashes);
      if (!headers.length) {
        logger.info(`${chain}:${network} up to date.`);
        break;
      }
      const headerCount = Math.min(headers.length, to - currentHeight);
      logger.info(`Re-Syncing ${headerCount} blocks for ${chain} ${network}`);
      let lastLog = Date.now();
      for (let header of headers) {
        if (currentHeight > to) {
          break;
        }
        const block = await this.getBlock(header.hash);
        await BlockStorage.processBlock({ chain, network, block, initialSyncComplete: true });
        currentHeight++;
        if (Date.now() - lastLog > 100) {
          logger.info(`Re-Sync `, {
            chain,
            network,
            height: currentHeight
          });
          lastLog = Date.now();
        }
      }
    }
    this.isSyncing = originalSyncValue;
  }

  get isSyncingNode(): boolean {
    if (!this.lastHeartBeat) {
      return false;
    }
    const [hostname, pid, timestamp] = this.lastHeartBeat.split(':');
    const hostNameMatches = hostname === os.hostname();
    const pidMatches = pid === process.pid.toString();
    const timestampIsFresh = Date.now() - parseInt(timestamp) < 60 * 1000;
    const amSyncingNode = hostNameMatches && pidMatches && timestampIsFresh;
    return amSyncingNode;
  }

  async refreshSyncingNode() {
    while (!this.stopping) {
      const wasSyncingNode = this.isSyncingNode;
      this.lastHeartBeat = await StateStorage.getSyncingNode({ chain: this.chain, network: this.network });
      const nowSyncingNode = this.isSyncingNode;
      if (wasSyncingNode && !nowSyncingNode) {
        throw new Error('Syncing Node Renewal Failure');
      }
      if (!wasSyncingNode && nowSyncingNode) {
        logger.info(`This worker is now the syncing node for ${this.chain} ${this.network}`);
        this.sync();
      }
      if (!this.lastHeartBeat || this.isSyncingNode) {
        this.registerSyncingNode({ primary: true });
      } else {
        this.registerSyncingNode({ primary: false });
      }
      await wait(500);
    }
  }

  async registerSyncingNode({ primary }) {
    const lastHeartBeat = this.lastHeartBeat;
    const queuedRegistration = setTimeout(
      () => {
        StateStorage.selfNominateSyncingNode({
          chain: this.chain,
          network: this.network,
          lastHeartBeat
        });
      },
      primary ? 0 : 60 * 1000
    );
    this.queuedRegistrations.push(queuedRegistration);
  }

  async unregisterSyncingNode() {
    await wait(1000);
    this.lastHeartBeat = await StateStorage.getSyncingNode({ chain: this.chain, network: this.network });
    if (this.isSyncingNode) {
      await StateStorage.selfResignSyncingNode({
        chain: this.chain,
        network: this.network,
        lastHeartBeat: this.lastHeartBeat
      });
    }
  }

  async stop() {
    this.stopping = true;
    logger.debug(`Stopping worker for chain ${this.chain}`);
    this.queuedRegistrations.forEach(clearTimeout);
    await this.unregisterSyncingNode();
    await this.disconnect();
  }

  async start() {
    logger.debug(`Started worker for chain ${this.chain}`);
    await this.connect();
    this.refreshSyncingNode();
  }
}

export const P2P = new P2pManager();
