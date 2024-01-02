import { EventEmitter } from 'events';
import * as os from 'os';
import Web3 from 'web3';
import { ChainStateProvider } from '../../';
import { timestamp } from '../../../../logger';
import logger from '../../../../logger';
import { StateStorage } from '../../../../models/state';
import { BaseP2PWorker } from '../../../../services/p2p';
import { IEVMNetworkConfig } from '../../../../types/Config';
import { valueOrDefault } from '../../../../utils/check';
import { wait } from '../../../../utils/wait';
import { BaseEVMStateProvider } from '../api/csp';
import { EVMBlockModel, EVMBlockStorage } from '../models/block';
import { EVMTransactionModel, EVMTransactionStorage } from '../models/transaction';
import { AnyBlock, ErigonTransaction, GethTransaction, IEVMBlock, IEVMTransactionInProcess } from '../types';
import { IRpc, Rpcs } from './rpcs';
import { MultiThreadSync } from './sync';

export class EVMP2pWorker extends BaseP2PWorker<IEVMBlock> {
  protected chainConfig: IEVMNetworkConfig;
  protected syncing: boolean;
  protected initialSyncComplete: boolean;
  protected blockModel: EVMBlockModel;
  protected txModel: EVMTransactionModel;
  protected txSubscription: any;
  protected blockSubscription: any;
  protected rpc?: IRpc;
  protected provider: BaseEVMStateProvider;
  protected web3?: Web3;
  protected client?: 'geth' | 'erigon';
  protected invCache: any;
  protected invCacheLimits: any;
  protected multiThreadSync: MultiThreadSync;
  public events: EventEmitter;
  public disconnecting: boolean;

  constructor({ chain, network, chainConfig, blockModel = EVMBlockStorage, txModel = EVMTransactionStorage }) {
    super({ chain, network, chainConfig, blockModel });
    this.chain = chain || 'ETH';
    this.network = network;
    this.chainConfig = chainConfig;
    this.syncing = false;
    this.initialSyncComplete = false;
    this.blockModel = blockModel;
    this.txModel = txModel;
    this.provider = new BaseEVMStateProvider(this.chain);
    this.events = new EventEmitter();
    this.invCache = {};
    this.invCacheLimits = {
      TX: 100000
    };
    this.disconnecting = false;
    this.multiThreadSync = new MultiThreadSync({ chain, network });
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
    const { host, port } = this.chainConfig.provider || this.chainConfig.providers![0];
    this.events.on('disconnected', async () => {
      logger.warn(
        `${timestamp()} | Not connected to peer: ${host}:${port} | Chain: ${this.chain} | Network: ${this.network}`
      );
    });
    this.events.on('connected', async () => {
      this.txSubscription = await this.web3!.eth.subscribe('pendingTransactions');
      this.txSubscription.subscribe(async (_err, txid) => {
        if (!this.isCachedInv('TX', txid)) {
          this.cacheInv('TX', txid);
          const tx = (await this.web3!.eth.getTransaction(txid)) as ErigonTransaction;
          if (tx) {
            await this.processTransaction(tx);
            this.events.emit('transaction', tx);
          }
        }
      });
      this.blockSubscription = await this.web3!.eth.subscribe('newBlockHeaders');
      this.blockSubscription.subscribe((_err, block) => {
        this.events.emit('block', block);
        if (!this.syncing) {
          this.sync();
        }
      });
    });

    this.multiThreadSync.once('INITIALSYNCDONE', () => {
      this.initialSyncComplete = true;
      this.events.emit('SYNCDONE');
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

  async getWeb3() {
    return this.provider.getWeb3(this.network);
  }

  async getClient() {
    try {
      const nodeVersion = await this.web3!.eth.getNodeInfo();
      const client = nodeVersion.split('/')[0].toLowerCase() as 'erigon' | 'geth';
      if (client !== 'erigon' && client !== 'geth') {
        // assume it's a geth fork, or at least more like geth.
        // this is helpful when using a dev solution like ganache.
        return 'geth';
      }
      return client;
    } catch (e) {
      console.error(e);
      return 'geth';
    }
  }

  async handleReconnects() {
    this.disconnecting = false;
    let firstConnect = true;
    let connected = false;
    let disconnected = false;
    const { host, port } = this.chainConfig.provider || this.chainConfig.providers![0];
    while (!this.disconnecting && !this.stopping) {
      try {
        if (!this.web3) {
          const { web3 } = await this.getWeb3();
          this.web3 = web3;
        }
        try {
          if (!this.client || !this.rpc) {
            this.client = await this.getClient();
            this.rpc = new Rpcs[this.client](this.web3);
          }
          connected = await this.web3.eth.net.isListening();
        } catch (e) {
          connected = false;
        }
        if (!connected) {
          this.web3 = undefined;
          this.client = undefined;
          this.events.emit('disconnected');
        } else if (disconnected || firstConnect) {
          this.events.emit('connected');
        }
        if (disconnected && connected && !firstConnect) {
          logger.warn(
            `${timestamp()} | Reconnected to peer: ${host}:${port} | Chain: ${this.chain} | Network: ${this.network}`
          );
        }
        if (connected && firstConnect) {
          firstConnect = false;
          logger.info(
            `${timestamp()} | Connected to peer: ${host}:${port} | Chain: ${this.chain} | Network: ${this.network}`
          );
        }
        disconnected = !connected;
      } catch (e) {}
      await wait(2000);
    }
  }

  async connect() {
    this.handleReconnects();
    return new Promise<void>(resolve => this.events.once('connected', resolve));
  }

  public async getBlock(height: number) {
    return this.rpc!.getBlock(height);
  }

  async processBlock(block: IEVMBlock, transactions: IEVMTransactionInProcess[]): Promise<any> {
    await this.blockModel.addBlock({
      chain: this.chain,
      network: this.network,
      forkHeight: this.chainConfig.forkHeight,
      parentChain: this.chainConfig.parentChain,
      initialSyncComplete: this.initialSyncComplete,
      block,
      transactions
    });
    if (!this.syncing) {
      logger.info(`Added block ${block.hash}`, {
        chain: this.chain,
        network: this.network
      });
    }
  }

  async processTransaction(tx: ErigonTransaction | GethTransaction) {
    const now = new Date();
    const convertedTx = this.convertTx(tx);
    this.txModel.batchImport({
      chain: this.chain,
      network: this.network,
      txs: [convertedTx],
      height: -1,
      mempoolTime: now,
      blockTime: now,
      blockTimeNormalized: now,
      initialSyncComplete: true
    });
  }

  useMultiThread() {
    if (this.chainConfig.threads == null) {
      // use multithread by default if there are >2 threads in the CPU
      return os.cpus().length > 2;
    }
    return this.chainConfig.threads > 0;
  }

  async sync() {
    if (this.syncing) {
      return false;
    }

    if (!this.initialSyncComplete && this.useMultiThread()) {
      return this.multiThreadSync.sync();
    }

    const { chain, chainConfig, network } = this;
    const { parentChain, forkHeight = 0 } = chainConfig;
    this.syncing = true;
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

    const startHeight = tip ? tip.height : chainConfig.syncStartHeight || 0;
    const startTime = Date.now();
    try {
      let bestBlock = await this.web3!.eth.getBlockNumber();
      let lastLog = 0;
      let currentHeight = tip ? tip.height : chainConfig.syncStartHeight || 0;
      logger.info(`Syncing ${bestBlock - currentHeight} blocks for ${chain} ${network}`);
      while (currentHeight <= bestBlock) {
        const block = await this.getBlock(currentHeight);
        if (!block) {
          await wait(1000);
          continue;
        }
        const { convertedBlock, convertedTxs } = await this.convertBlock(block);
        await this.processBlock(convertedBlock, convertedTxs);
        if (currentHeight === bestBlock) {
          bestBlock = await this.web3!.eth.getBlockNumber();
        }
        tip = await ChainStateProvider.getLocalTip({ chain, network });
        currentHeight = tip ? tip.height + 1 : 0;

        const oneSecond = 1000;
        const now = Date.now();
        if (now - lastLog > oneSecond) {
          const blocksProcessed = currentHeight - startHeight;
          const elapsedMinutes = (now - startTime) / (60 * oneSecond);
          logger.info(
            `${timestamp()} | Syncing... | Chain: ${chain} | Network: ${network} |${(blocksProcessed / elapsedMinutes)
              .toFixed(2)
              .padStart(8)} blocks/min | Height: ${currentHeight.toString().padStart(7)}`
          );
          lastLog = Date.now();
        }
      }
    } catch (err: any) {
      logger.error(`Error syncing ${chain} ${network} -- %o`, err);
      await wait(2000);
      this.syncing = false;
      return this.sync();
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
  }

  async syncDone() {
    return new Promise(resolve => this.events.once('SYNCDONE', resolve));
  }

  getBlockReward(block: AnyBlock): number {
    // TODO: implement block reward
    block;
    return 0;
  }

  async convertBlock(block: AnyBlock) {
    const blockTime = Number(block.timestamp) * 1000;
    const hash = block.hash;
    const height = block.number;
    const reward = this.getBlockReward(block);

    const convertedBlock: IEVMBlock = {
      chain: this.chain,
      network: this.network,
      height,
      hash,
      coinbase: Buffer.from(block.miner),
      merkleRoot: Buffer.from(block.transactionsRoot),
      time: new Date(blockTime),
      timeNormalized: new Date(blockTime),
      nonce: Buffer.from(block.extraData),
      previousBlockHash: block.parentHash,
      difficulty: block.difficulty,
      totalDifficulty: block.totalDifficulty,
      nextBlockHash: '',
      transactionCount: block.transactions.length,
      size: block.size,
      reward,
      logsBloom: Buffer.from(block.logsBloom),
      sha3Uncles: Buffer.from(block.sha3Uncles),
      receiptsRoot: Buffer.from(block.receiptsRoot),
      processed: false,
      gasLimit: block.gasLimit,
      gasUsed: block.gasUsed,
      stateRoot: Buffer.from(block.stateRoot)
    };
    const convertedTxs = block.transactions.map(t => this.convertTx(t, convertedBlock));
    const traceTxs = await this.rpc!.getTransactionsFromBlock(convertedBlock.height);
    this.rpc!.reconcileTraces(convertedBlock, convertedTxs, traceTxs);
    EVMTransactionStorage.addEffectsToTxs(convertedTxs);
    return { convertedBlock, convertedTxs };
  }

  convertTx(tx: Partial<ErigonTransaction | GethTransaction>, block?: IEVMBlock): IEVMTransactionInProcess {
    if (!block) {
      const txid = tx.hash || '';
      const to = tx.to || '';
      const from = tx.from || '';
      const value = Number(tx.value);
      const fee = Number(tx.gas) * Number(tx.gasPrice);
      const abiType = this.txModel.abiDecode(tx.input!);
      const nonce = tx.nonce || 0;
      const convertedTx: IEVMTransactionInProcess = {
        chain: this.chain,
        network: this.network,
        blockHeight: valueOrDefault(tx.blockNumber, -1),
        blockHash: valueOrDefault(tx.blockHash, undefined),
        data: Buffer.from(tx.input || '0x'),
        txid,
        blockTime: new Date(),
        blockTimeNormalized: new Date(),
        fee,
        transactionIndex: tx.transactionIndex || 0,
        value,
        wallets: [],
        to,
        from,
        gasLimit: Number(tx.gas),
        gasPrice: Number(tx.gasPrice),
        nonce,
        internal: [],
        calls: []
      };
      if (abiType) {
        convertedTx.abiType = abiType;
      }
      return convertedTx;
    } else {
      const { hash: blockHash, time: blockTime, timeNormalized: blockTimeNormalized, height } = block;
      const noBlockTx = this.convertTx(tx);
      return {
        ...noBlockTx,
        blockHeight: height,
        blockHash,
        blockTime,
        blockTimeNormalized
      };
    }
  }

  async stop() {
    this.stopping = true;
    this.multiThreadSync.stop();
    logger.debug(`Stopping worker for chain ${this.chain} ${this.network}`);
    await this.disconnect();
  }

  async start() {
    logger.debug(`Started worker for chain ${this.chain} ${this.network}`);
    this.setupListeners();
    await this.connect();
    this.sync();
  }
}
