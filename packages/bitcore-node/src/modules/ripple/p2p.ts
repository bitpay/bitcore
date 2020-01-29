import logger from '../../logger';
import { EventEmitter } from 'events';
import { StateStorage } from '../../models/state';
import { BaseP2PWorker } from '../../services/p2p';
import { timestamp } from '../../logger';
import { wait } from '../../utils/wait';
import { RippleStateProvider } from './api/csp';
import { RippleAPI } from 'ripple-lib';
import { XrpBlockModel, XrpBlockStorage } from './models/block';
import { IXrpBlock, IXrpTransaction, IXrpCoin } from './types';
import { LoggifyClass } from '../../decorators/Loggify';

@LoggifyClass
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
  public blockModel: XrpBlockModel;

  constructor({ chain, network, chainConfig, blockModel = XrpBlockStorage }) {
    super({ chain, network, chainConfig, blockModel });
    this.blockModel = blockModel;
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
    this.events.on('connected', async () => {
      this.client!.on('ledger', async () => {
        this.sync();
      });
    });
  }

  async disconnect() {
    this.disconnecting = true;
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
          this.client = await this.provider.getClient(this.network);
          connected = this.client.isConnected();
        } catch (e) {
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

    try {
      const client = await this.provider.getClient(this.network);
      let ourBestBlock = await this.provider.getLocalTip({ chain, network });
      let chainBestBlock = await client.getLedgerVersion();

      const startTime = Date.now();
      let lastLog = Date.now();

      if (!ourBestBlock) {
        logger.info(`Starting XRP Sync @ ${chainBestBlock}`);
        const startHeight = this.chainConfig.startHeight || chainBestBlock - 2000;
        ourBestBlock = { height: chainBestBlock > 2000 ? startHeight : chainBestBlock } as IXrpBlock;
      }
      const startHeight = ourBestBlock.height;
      let currentHeight = startHeight;
      while (ourBestBlock.height < chainBestBlock) {
        currentHeight = ourBestBlock.height + 1;
        const block = await client.getLedger({
          ledgerVersion: currentHeight,
          includeTransactions: true,
          includeAllData: true
        });
        const transformedBlock = this.provider.transformLedger(block, network);
        const coinsAndTxs = (block.transactions || [])
          .map((tx: any) => ({
            tx: this.provider.transform(tx, network, transformedBlock),
            coins: this.provider.transformToCoins(tx, network)
          }))
          .filter(data => {
            return 'txid' in data.tx && data.tx.txid != null;
          }) as Array<{ tx: IXrpTransaction; coins: Array<IXrpCoin> }>;
        const blockTxs = new Array<IXrpTransaction>();
        const blockCoins = new Array<IXrpCoin>();

        for (const coinAndTx of coinsAndTxs) {
          const { transaction, coins } = await this.provider.tag(chain, network, coinAndTx.tx, coinAndTx.coins);
          if (this.chainConfig.walletOnlySync && !transaction.wallets.length) {
            continue;
          }
          blockTxs.push(transaction);
          blockCoins.push(...(coins as Array<IXrpCoin>));
        }

        await this.blockModel.processBlock({
          chain,
          network,
          block: transformedBlock,
          transactions: blockTxs,
          coins: blockCoins,
          initialSyncComplete: true
        });

        this.maybeLog(chain, network, startHeight, currentHeight, startTime, lastLog);
        lastLog = Date.now();
        ourBestBlock = await this.provider.getLocalTip({ chain, network });
        if (ourBestBlock.height === chainBestBlock) {
          chainBestBlock = await client.getLedgerVersion();
        }
      }

      logger.info(`${chain}:${network} up to date.`);
      this.syncing = false;
      StateStorage.collection.findOneAndUpdate(
        {},
        { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
        { upsert: true }
      );
      this.events.emit('SYNCDONE');
      return true;
    } catch (e) {
      this.syncing = false;
      await wait(2000);
      return this.sync();
    }
  }

  maybeLog(
    chain: string,
    network: string,
    startHeight: number,
    currentHeight: number,
    startTime: number,
    lastLog: number
  ) {
    const oneSecond = 1000;
    const now = Date.now();
    if (now - lastLog > oneSecond || startHeight === currentHeight) {
      const blocksProcessed = currentHeight - startHeight;
      const elapsedMinutes = (now - startTime) / (60 * oneSecond);
      logger.info(
        `${timestamp()} | Syncing... | Chain: ${chain} | Network: ${network} |${(blocksProcessed / elapsedMinutes)
          .toFixed(2)
          .padStart(8)} blocks/min | Height: ${currentHeight.toString().padStart(7)}`
      );
    }
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
    await this.setupListeners();
    this.sync();
  }
}
