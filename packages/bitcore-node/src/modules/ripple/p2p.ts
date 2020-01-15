import logger from '../../logger';
import { EventEmitter } from 'events';
import { StateStorage } from '../../models/state';
import { BaseP2PWorker } from '../../services/p2p';
import { timestamp } from '../../logger';
import { wait } from '../../utils/wait';
import { RippleStateProvider } from './api/csp';
import { RippleAPI } from 'ripple-lib';

export class XrpP2pWorker extends BaseP2PWorker<any> {
  protected chainConfig: any;
  protected syncing: boolean;
  protected initialSyncComplete: boolean;
  public provider: RippleStateProvider;
  protected txSubscription: any;
  protected blockSubscription: any;
  protected invCache: any;
  protected invCacheLimits: any;
  public events: EventEmitter;
  public disconnecting: boolean;
  public client?: RippleAPI;

  constructor({ chain, network, chainConfig }) {
    super({ chain, network, chainConfig });
    this.chain = chain || 'XRP';
    this.network = network;
    this.chainConfig = chainConfig;
    this.syncing = false;
    this.initialSyncComplete = false;
    this.provider = new RippleStateProvider(this.chain);
    this.events = new EventEmitter();
    this.invCache = {};
    this.invCacheLimits = {
      TX: 100000
    };
    this.disconnecting = false;
  }

  cacheInv(type: 'TX', hash: string): void {
    if (!this.invCache[type]) {
      this.invCache[type] = [];
    }
    if (this.invCache[type].length > this.invCacheLimits[type]) {
      this.invCache[type].shift();
    }
    this.invCache[type].push(hash);
  }

  isCachedInv(type: 'TX', hash: string): boolean {
    if (!this.invCache[type]) {
      this.invCache[type] = [];
    }
    return this.invCache[type].includes(hash);
  }

  async setupListeners() {
    const { host, port } = this.chainConfig.provider;
    this.events.on('disconnected', async () => {
      logger.warn(
        `${timestamp()} | Not connected to peer: ${host}:${port || ''} | Chain: ${this.chain} | Network: ${
          this.network
        }`
      );
    });
    const chain = this.chain;
    const network = this.network;
    const csp = new RippleStateProvider(chain);
    this.events.on('connected', async () => {
      const client = this.client || (await csp.getClient(network));

      client.on('ledger', async ledger => {
        const block = await client.getLedger({
          ledgerHash: ledger.ledgerHash,
          includeTransactions: true,
          includeAllData: true
        });
        const coinsAndTxs = (block.transactions || [])
          .map((tx: any) => ({
            tx: csp.transform(tx, network, ledger),
            coins: csp.transformToCoins(tx, network)
          }))
          .filter(tx => 'chain' in tx.tx);
        for (const coinAndTx of coinsAndTxs) {
          if ('chain' in coinAndTx.tx) {
            const { transaction, coins } = await csp.tag(chain, network, coinAndTx.tx, coinAndTx.coins);
            console.log('Tagged blockTx', transaction.from, coins.length);
          }
        }
      });
    });
  }

  async disconnect() {
    this.disconnecting = true;
    try {
      if (this.txSubscription) {
        this.txSubscription.unsubscribe();
      }
      if (this.blockSubscription) {
        this.blockSubscription.unsubscribe();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async handleReconnects() {
    this.disconnecting = false;
    let firstConnect = true;
    let connected = false;
    let disconnected = false;
    const { host, port } = this.chainConfig.provider;
    while (!this.disconnecting && !this.stopping) {
      try {
        try {
          console.log('Checking connection');
          this.client = await this.provider.getClient(this.network);
          connected = this.client.isConnected();
          console.log('Checked connection', connected);
        } catch (e) {
          console.log('Disconnected');
          connected = false;
        }
        if (connected) {
          if (disconnected || firstConnect) {
            this.events.emit('connected');
          }
        } else {
          this.client = await this.provider.getClient(this.network);
          this.events.emit('disconnected');
        }
        if (disconnected && connected && !firstConnect) {
          logger.warn(
            `${timestamp()} | Reconnected to peer: ${host}:${port || ''} | Chain: ${this.chain} | Network: ${
              this.network
            }`
          );
        }
        if (connected && firstConnect) {
          firstConnect = false;
          logger.info(
            `${timestamp()} | Connected to peer: ${host}:${port || ''} | Chain: ${this.chain} | Network: ${
              this.network
            }`
          );
        }
        disconnected = !connected;
      } catch (e) {}
      await wait(5000);
    }
  }

  async connect() {
    this.handleReconnects();
  }

  public async getBlock(height: number) {
    return this.provider.getBlock({ chain: this.chain, network: this.network, blockId: height.toString() });
  }

  async sync() {
    if (this.syncing) {
      return false;
    }
    const { chain, network } = this;
    this.syncing = true;

    logger.info(`${chain}:${network} up to date.`);
    this.syncing = false;
    StateStorage.collection.findOneAndUpdate(
      {},
      { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
      { upsert: true }
    );
    this.events.emit('SYNCDONE');
    return true;
  }

  async syncDone() {
    return new Promise(resolve => this.events.once('SYNCDONE', resolve));
  }

  async stop() {
    this.stopping = true;
    logger.debug(`Stopping worker for chain ${this.chain} ${this.network}`);
    await this.disconnect();
  }

  async start() {
    logger.debug(`Started worker for chain ${this.chain} ${this.network}`);
    this.connect();
    this.setupListeners();
    this.sync();
  }
}
