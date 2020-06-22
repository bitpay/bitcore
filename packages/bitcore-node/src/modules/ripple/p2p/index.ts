import { EventEmitter } from 'events';
import { RippleAPI } from 'ripple-lib';
import { Transform } from 'stream';
import { LoggifyClass } from '../../../decorators/Loggify';
import logger from '../../../logger';
import { timestamp } from '../../../logger';
import { CacheStorage } from '../../../models/cache';
import { StateStorage } from '../../../models/state';
import { IWalletAddress, WalletAddressStorage } from '../../../models/walletAddress';
import { BaseP2PWorker } from '../../../services/p2p';
import { wait } from '../../../utils/wait';
import { RippleStateProvider } from '../api/csp';
import { XrpBlockModel, XrpBlockStorage } from '../models/block';
import { XrpTransactionStorage } from '../models/transaction';
import { IXrpBlock, IXrpCoin, IXrpTransaction } from '../types';

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

  async syncWallets() {
    return new Promise(async resolve => {
      try {
        const { chain, network } = this;

        // After wallet syncs, start block sync from the current height
        const client = await this.provider.getClient(this.network);
        let chainBestBlock = await client.getLedgerVersion();
        this.chainConfig.startHeight = chainBestBlock;

        const count = await WalletAddressStorage.collection.countDocuments({ chain, network });
        let done = 0;
        logger.info(`Syncing ${count} ${chain} ${network} wallets`);
        let lastLog = Date.now();
        const addressStream = WalletAddressStorage.collection.find({ chain, network }).stream();
        addressStream
          .pipe(
            new Transform({
              objectMode: true,
              transform: async (data, _, cb) => {
                if (Date.now() - 5000 > lastLog) {
                  logger.info(`Syncing ${count - done} ${chain} ${network} wallets`);
                }
                const walletAddress = (data as any) as IWalletAddress;
                const [lastTx] = await XrpTransactionStorage.collection
                  .find({ wallets: walletAddress.wallet, 'wallets.0': { $exists: true } })
                  .sort({ blockTimeNormalized: -1 })
                  .limit(1)
                  .toArray();
                const synced = await CacheStorage.getForWallet(walletAddress.wallet, `sync-${walletAddress.address}`);
                if (synced) {
                  // if this is happening, it means initial sync wasn't completed the first time, likely due to a crash
                  return cb();
                }
                const txs = await this.provider.getAddressTransactions({
                  chain: this.chain,
                  network: this.network,
                  address: walletAddress.address,
                  args: {
                    ...(lastTx && !this.chainConfig.freshSync && { startTx: lastTx.txid })
                  }
                });
                if (txs.length) {
                  logger.info(`Saving ${txs.length} transactions`);
                }
                const blockTxs = new Array<IXrpTransaction>();
                const blockCoins = new Array<IXrpCoin>();

                for (const tx of txs) {
                  const bitcoreTx = this.provider.transform(tx, network) as IXrpTransaction;
                  const bitcoreCoins = this.provider.transformToCoins(tx, network);
                  const { transaction, coins } = await this.provider.tag(chain, network, bitcoreTx, bitcoreCoins);
                  blockTxs.push(transaction);
                  blockCoins.push(...coins);
                }

                await XrpTransactionStorage.batchImport({
                  txs: blockTxs,
                  coins: blockCoins,
                  chain,
                  network,
                  initialSyncComplete: false
                });

                await CacheStorage.setForWallet(
                  walletAddress.wallet,
                  `sync-${walletAddress.address}`,
                  true,
                  CacheStorage.Times.Hour / 2
                );
                done++;
                cb();
              }
            })
          )
          .on('finish', async () => {
            logger.info(`FINISHED Syncing ${count} ${chain} ${network} wallets`);
            this.initialSyncComplete = true;
            await StateStorage.collection.findOneAndUpdate(
              {},
              { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
              { upsert: true }
            );
            resolve();
          });
      } catch (e) {
        logger.error(e);
      }
    });
  }

  async syncBlocks() {
    const { chain, network } = this;
    const client = await this.provider.getClient(this.network);
    let ourBestBlock = await this.provider.getLocalTip({ chain, network });
    let chainBestBlock = await client.getLedgerVersion();

    const startTime = Date.now();
    let lastLog = Date.now();

    if (!ourBestBlock || this.chainConfig.walletOnlySync) {
      let configuredStart = this.chainConfig.startHeight;
      const shouldResume = !configuredStart || ourBestBlock.height > configuredStart;
      if (ourBestBlock && shouldResume) {
        configuredStart = ourBestBlock.height;
      }
      if (configuredStart === undefined) {
        configuredStart = chainBestBlock - 1;
      }
      const defaultBestBlock = { height: configuredStart } as IXrpBlock;
      logger.info(`Starting XRP Sync @ ${configuredStart}`);
      ourBestBlock = defaultBestBlock;
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
      if (!block) {
        await wait(2000);
        continue;
      }
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
  }

  async sync() {
    if (this.syncing) {
      return false;
    }
    const { chain, network } = this;
    this.syncing = true;
    const state = await StateStorage.collection.findOne({});
    this.initialSyncComplete =
      state && state.initialSyncComplete && state.initialSyncComplete.includes(`${chain}:${network}`);
    try {
      if (this.chainConfig.walletOnlySync && !this.initialSyncComplete) {
        await this.syncWallets();
      } else {
        await this.syncBlocks();
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
      logger.error(e);
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
