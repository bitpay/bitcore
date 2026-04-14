import { EventEmitter } from 'events';
import * as os from 'os';
import logger, { timestamp } from '../../logger';
import { BitcoinBlock, BitcoinBlockStorage, IBtcBlock } from '../../models/block';
import { StateStorage } from '../../models/state';
import { TransactionStorage } from '../../models/transaction';
import { ChainStateProvider } from '../../providers/chain-state';
import { Libs } from '../../providers/libs';
import { Config } from '../../services/config';
import { BaseP2PWorker } from '../../services/p2p';
import { SpentHeightIndicators } from '../../types/Coin';
import { IUtxoNetworkConfig } from '../../types/Config';
import { BitcoinBlockType, BitcoinHeaderObj, BitcoinTransaction } from '../../types/namespaces/Bitcoin';
import { wait } from '../../utils';
import { UtxoMultiThreadSync } from './sync';

export class BitcoinP2PWorker extends BaseP2PWorker<IBtcBlock> {
  protected bitcoreLib: any;
  protected bitcoreP2p: any;
  protected chainConfig: IUtxoNetworkConfig;
  protected messages: any;
  protected connectInterval?: NodeJS.Timeout;
  protected invCache: any;
  protected invCacheLimits: any;
  protected initialSyncComplete: boolean;
  protected blockModel: BitcoinBlock;
  protected pool: any;
  protected multiThreadSync: UtxoMultiThreadSync;
  public events: EventEmitter;
  public isSyncing: boolean;
  constructor({ chain, network, chainConfig, blockModel = BitcoinBlockStorage }) {
    super({ chain, network, chainConfig, blockModel });
    this.blockModel = blockModel;
    this.chain = chain;
    this.network = network;
    this.bitcoreLib = Libs.get(chain).lib;
    this.bitcoreP2p = Libs.get(chain).p2p;
    this.chainConfig = chainConfig;
    this.events = new EventEmitter();
    this.isSyncing = false;
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
    this.multiThreadSync = new UtxoMultiThreadSync({
      chain,
      network,
      config: chainConfig,
      callbacks: {
        getHeaders: () => this.getHeadersForSync(),
        processBlock: (block) => this.processBlock(block),
        getLocalTip: () => ChainStateProvider.getLocalTip({ chain, network }),
        deserializeBlock: (rawHex) => new this.bitcoreLib.Block(Buffer.from(rawHex, 'hex'))
      }
    });
    this.multiThreadSync.once('INITIALSYNCDONE', async () => {
      this.initialSyncComplete = true;
      await StateStorage.collection.findOneAndUpdate(
        {},
        { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
        { upsert: true }
      );
      this.events.emit('SYNCDONE');
    });
    process.on('SIGUSR1', async () => {
      await this.reload();
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
      logger.info(
        `${timestamp()} | Connected to peer: ${peer.host}:${peer.port.toString().padEnd(5)} | Chain: ${
          this.chain
        } | Network: ${this.network}`
      );
    });

    this.pool.on('peerconnect', peer => {
      logger.info(
        `${timestamp()} | Connected to peer: ${peer.host}:${peer.port.toString().padEnd(5)} | Chain: ${
          this.chain
        } | Network: ${this.network}`
      );
    });

    this.pool.on('peerdisconnect', peer => {
      logger.warn(
        `${timestamp()} | Not connected to peer: ${peer.host}:${peer.port.toString().padEnd(5)} | Chain: ${
          this.chain
        } | Network: ${this.network}`
      );
    });

    this.pool.on('peertx', async (peer, message) => {
      try {
        const hash = message.transaction.hash;
        logger.debug('peer tx received: %o', {
          peer: `${peer.host}:${peer.port}`,
          chain: this.chain,
          network: this.network,
          hash
        });
        if (this.isSyncingNode && !this.isCachedInv(this.bitcoreP2p.Inventory.TYPE.TX, hash)) {
          this.cacheInv(this.bitcoreP2p.Inventory.TYPE.TX, hash);
          await this.processTransaction(message.transaction);
          this.events.emit('transaction', message.transaction);
        }
      } catch (err) {
        logger.error('Error in peertx handler:', err);
      }
    });

    this.pool.on('peerblock', async (peer, message) => {
      try {
        const { block } = message;
        const { hash } = block;
        logger.debug('peer block received: %o', {
          peer: `${peer.host}:${peer.port}`,
          chain: this.chain,
          network: this.network,
          hash
        });

        const blockInCache = this.isCachedInv(this.bitcoreP2p.Inventory.TYPE.BLOCK, hash);
        if (!blockInCache) {
          for (const transaction of block.transactions) {
            this.cacheInv(this.bitcoreP2p.Inventory.TYPE.TX, transaction.hash);
          }
          this.cacheInv(this.bitcoreP2p.Inventory.TYPE.BLOCK, hash);
        }
        if (this.isSyncingNode && (!blockInCache || this.isSyncing)) {
          this.events.emit(hash, message.block);
          this.events.emit('block', message.block);
          if (!this.isSyncing) {
            this.sync();
          }
        }
      } catch (err) {
        logger.error('Error in peerblock handler:', err);
      }
    });

    this.pool.on('peerheaders', (peer, message) => {
      logger.debug('peerheaders message received: %o', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        count: message.headers.length
      });
      this.events.emit('headers', message.headers);
    });

    this.pool.on('peerinv', (peer, message) => {
      if (this.isSyncingNode) {
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

  async reload() {
    this.chainConfig = Config.chainConfig({ chain: this.chain, network: this.network }) as IUtxoNetworkConfig;
    const configPeerUris: string[] = [];

    for (const peer of Object.values(this.chainConfig.trustedPeers) as any[]) {
      const uri = peer.host + ':' + peer.port;
      configPeerUris.push(uri);
      const hashes = Object.values(this.pool._addrs).map((a: any) => a.hash);
      const addr = this.pool._addAddr({ ip: { v4: peer.host }, port: peer.port });
      if (!hashes.includes(addr.hash)) {
        logger.info(`Adding peer ${uri}`);
      }
    }

    for (const addr of Object.values(this.pool._addrs) as any[]) {
      const uri = addr.ip.v4 + ':' + addr.port;
      if (!configPeerUris.includes(uri)) {
        this.pool._addrs = (this.pool._addrs as any[]).filter(({ hash }) => hash !== addr.hash);
        if (this.pool._connectedPeers[addr.hash]) {
          logger.info(`Removing peer ${uri}`);
        } else {
          logger.info(`Removing unconnected peer ${uri}`);
          continue;
        }
        this.pool._connectedPeers[addr.hash].disconnect();
        delete this.pool._connectedPeers[addr.hash];
      }
    };
  }

  public async getHeaders(candidateHashes: string[]): Promise<BitcoinHeaderObj[]> {
    let received = false;
    return new Promise<BitcoinHeaderObj[]>(async resolve => {
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
    return new Promise<BitcoinBlockType>(async resolve => {
      this.events.once(hash, (block: BitcoinBlockType) => {
        logger.debug('Received block, hash: %o', hash);
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

  async processBlock(block: BitcoinBlockType): Promise<any> {
    await this.blockModel.addBlock({
      chain: this.chain,
      network: this.network,
      forkHeight: this.chainConfig.forkHeight,
      parentChain: this.chainConfig.parentChain,
      initialSyncComplete: this.initialSyncComplete,
      block,
      initialHeight: this.chainConfig.syncStartHeight
    });
  }

  async processTransaction(tx: BitcoinTransaction): Promise<any> {
    const now = new Date();
    await TransactionStorage.batchImport({
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

  useMultiThread(): boolean {
    if (this.chainConfig.threads == null) {
      // use multithread by default if there are >2 threads in the CPU
      return os.cpus().length > 2;
    }
    return this.chainConfig.threads > 0;
  }

  // Get headers using locator hashes (shared between sync modes)
  private async getHeadersForSync(): Promise<BitcoinHeaderObj[]> {
    const { chain, network } = this;
    let locators = await ChainStateProvider.getLocatorHashes({ chain, network });
    if (locators.length === 1 && locators[0] === Array(65).join('0') && this.chainConfig.syncStartHash) {
      locators = [this.chainConfig.syncStartHash];
    }
    return this.getHeaders(locators);
  }

  // Handle genesis block fetch (needed when syncing from height 0)
  private async handleGenesisBlock(headers: BitcoinHeaderObj[]): Promise<number> {
    if (headers[0]) {
      const block = await this.getBlock(headers[0].hash);
      if (block.header.prevHash) {
        const prevHash = Buffer.from(block.header.prevHash).reverse().toString('hex');
        const genesisBlock = await this.getBlock(prevHash);
        await this.processBlock(genesisBlock);
        return 1;
      }
    }
    return 0;
  }

  async sync() {
    if (this.isSyncing) {
      return false;
    }

    // Multi-thread mode check BEFORE DB read (matches EVM pattern).
    // The in-memory flag is set by INITIALSYNCDONE event after multi-thread sync finishes.
    // Reading from DB here would overwrite it back to false before the DB is updated.
    if (!this.initialSyncComplete && this.useMultiThread()) {
      this.isSyncing = true;
      const { chain, chainConfig, network } = this;
      const { parentChain, forkHeight } = chainConfig;

      let tip = await ChainStateProvider.getLocalTip({ chain, network });
      if (parentChain && (!tip || tip.height < forkHeight!)) {
        let parentTip = await ChainStateProvider.getLocalTip({ chain: parentChain, network });
        while (!parentTip || parentTip.height < forkHeight!) {
          logger.info(`Waiting until ${parentChain} syncs before ${chain} ${network}`);
          await wait(5000);
          parentTip = await ChainStateProvider.getLocalTip({ chain: parentChain, network });
        }
      }

      // Handle genesis block before multi-thread sync
      tip = await ChainStateProvider.getLocalTip({ chain, network });
      const currentHeight = tip?.height ?? (chainConfig.syncStartHeight || 0);
      if (currentHeight === 0) {
        const headers = await this.getHeadersForSync();
        if (headers.length > 0) {
          await this.handleGenesisBlock(headers);
        }
      }

      logger.info(`${timestamp()} | Starting multi-thread sync | Chain: ${chain} | Network: ${network}`);
      this.isSyncing = false;
      return this.multiThreadSync.sync();
    }

    // Single-thread mode with prefetching (for near-tip sync and post-initial sync)
    this.isSyncing = true;
    const { chain, chainConfig, network } = this;
    const { parentChain, forkHeight } = chainConfig;
    const state = await StateStorage.collection.findOne({});
    this.initialSyncComplete = state?.initialSyncComplete?.includes(`${chain}:${network}`);
    let tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (parentChain && (!tip || tip.height < forkHeight!)) {
      let parentTip = await ChainStateProvider.getLocalTip({ chain: parentChain, network });
      while (!parentTip || parentTip.height < forkHeight!) {
        logger.info(`Waiting until ${parentChain} syncs before ${chain} ${network}`);
        await wait(5000);
        parentTip = await ChainStateProvider.getLocalTip({ chain: parentChain, network });
      }
    }

    // Handle genesis block
    tip = await ChainStateProvider.getLocalTip({ chain, network });
    const currentHeight = tip?.height ?? (chainConfig.syncStartHeight || 0);
    if (currentHeight === 0) {
      const genesisHeaders = await this.getHeadersForSync();
      if (genesisHeaders.length > 0) {
        await this.handleGenesisBlock(genesisHeaders);
      }
    }

    const prefetchSize = chainConfig.prefetchSize ?? 10;

    let headers = await this.getHeadersForSync();
    while (headers.length > 0) {
      tip = await ChainStateProvider.getLocalTip({ chain, network });
      let height = tip?.height ?? (chainConfig.syncStartHeight || 0);
      const startingHeight = height;
      const startingTime = Date.now();
      let lastLog = startingTime;
      logger.info(
        `${timestamp()} | Syncing ${headers.length} blocks | Chain: ${chain} | Network: ${network}` +
          (prefetchSize > 0 ? ` | Prefetch: ${prefetchSize}` : '')
      );

      // Prefetch: kick off parallel block downloads ahead of processing.
      // Blocks are still processed sequentially to preserve UTXO ordering.
      const prefetchMap = new Map<string, Promise<BitcoinBlockType>>();
      const initialBatch = Math.min(prefetchSize, headers.length);
      for (let i = 0; i < initialBatch; i++) {
        prefetchMap.set(headers[i].hash, this.getBlock(headers[i].hash));
      }

      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        try {
          const block = await (prefetchMap.get(header.hash) || this.getBlock(header.hash));
          prefetchMap.delete(header.hash);

          // Queue next block prefetch (sliding window)
          const nextIdx = i + prefetchSize;
          if (prefetchSize > 0 && nextIdx < headers.length) {
            prefetchMap.set(headers[nextIdx].hash, this.getBlock(headers[nextIdx].hash));
          }

          await this.processBlock(block);
          height++;
          const now = Date.now();
          const oneSecond = 1000;
          if (now - lastLog > oneSecond) {
            const blocksProcessed = height - startingHeight;
            const elapsedMinutes = (now - startingTime) / (60 * oneSecond);
            logger.info(
              `${timestamp()} | Syncing... | Chain: ${chain} | Network: ${network} |${(blocksProcessed / elapsedMinutes)
                .toFixed(2)
                .padStart(8)} blocks/min | Height: ${height.toString().padStart(7)}`
            );
            lastLog = now;
          }
        } catch (err) {
          logger.error(`${timestamp()} | Error syncing | Chain: ${chain} | Network: ${network} | %o`, err);
          this.isSyncing = false;
          return this.sync();
        }
      }
      headers = await this.getHeadersForSync();
    }

    logger.info(`${timestamp()} | Sync completed | Chain: ${chain} | Network: ${network}`);
    this.isSyncing = false;
    await StateStorage.collection.findOneAndUpdate(
      {},
      { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
      { upsert: true }
    );
    this.events.emit('SYNCDONE');
    return true;
  }

  async stop() {
    this.stopping = true;
    this.multiThreadSync.stop();
    logger.debug(`Stopping worker for chain ${this.chain}`);
    for (const queuedRegistration of this.queuedRegistrations) {
      clearTimeout(queuedRegistration);
    }
    await this.unregisterSyncingNode();
    await this.disconnect();
  }

  async start() {
    logger.debug(`Started worker for chain ${this.chain}`);
    await this.connect();
    this.refreshSyncingNode();
  }
}
