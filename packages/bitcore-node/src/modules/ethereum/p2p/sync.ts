import { CryptoRpc } from 'crypto-rpc';
import { EventEmitter } from 'events';
import * as os from 'os';
import { threadId, Worker as Thread } from 'worker_threads';
import Config from '../../../config';
import logger, { timestamp } from '../../../logger';
import { StateStorage } from '../../../models/state';
import { ChainStateProvider } from '../../../providers/chain-state';
import { IEthNetworkConfig } from '../../../types/Config';
import { wait } from '../../../utils/wait';
import { EthBlockStorage } from '../models/block';

export class MultiThreadSync extends EventEmitter {
  private chain: string;
  private network: string;
  private syncInterval?: NodeJS.Timeout;
  private threads: Thread[] = [];
  private syncingThreads: number = 0;
  private bestBlock: number = 0;
  private syncHeight: number = 0;
  private stopping: boolean = false;
  private syncQueue: number[] = [];
  private syncing: boolean = false;
  private config: IEthNetworkConfig;
  protected currentHeight: number = 0;

  constructor({ chain, network }) {
    super();
    this.chain = chain || 'ETH';
    this.network = network || 'mainnet';
    this.config = Config.chains[chain][network];
  }

  async syncBlock(blockNum) {
    this.syncQueue.push(blockNum);
  }

  async sync() {
    if (this.syncing) {
      return false;
    }
    const { chain, network } = this;
    const { parentChain, forkHeight = 0 } = this.config;
    this.syncing = true;

    try {
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

      let startHeight = tip ? tip.height : this.config.syncStartHeight || 0;

      const providerIdx = threadId % (this.config.providers || []).length;
      const providerConfig = this.config.provider || this.config.providers![providerIdx];
      const rpcConfig = { ...providerConfig, chain: this.chain, currencyConfig: {} };
      const rpc = new CryptoRpc(rpcConfig, {}).get(this.chain);
      this.bestBlock = await rpc.web3!.eth.getBlockNumber();
      this.currentHeight = tip ? tip.height : this.config.syncStartHeight || 0;
      this.syncHeight = this.currentHeight;
      startHeight = this.currentHeight;
      logger.info(`Syncing ${this.bestBlock - this.currentHeight} blocks for ${chain} ${network}`);

      await this.initializeThreads();

      const startTime = Date.now();
      const oneSecond = 1000;

      this.syncInterval = setInterval(() => {
        // TODO account for this.syncQueue
        const blocksProcessed = this.currentHeight - startHeight;
        const elapsedMinutes = (Date.now() - startTime) / (60 * oneSecond);
        logger.info(
          `${timestamp()} | Syncing... | Chain: ${chain} | Network: ${network} |${(blocksProcessed / elapsedMinutes)
            .toFixed(2)
            .padStart(8)} blocks/min | Height: ${this.currentHeight.toString().padStart(7)}`
        );
      }, oneSecond);

      this.syncingThreads = this.threads.length;
      for (let i = 0; i < this.threads.length; i++) {
        this.threads[i].postMessage({ blockNum: this.currentHeight++ });
      }
    } catch (err) {
      logger.error(`Error syncing ${chain} ${network} :: ${err.message}`);
      await wait(2000);
      this.syncing = false;
      return this.sync();
    }
    return true;
  }

  threadMessageHandler(thread: Thread) {
    const self = this;
    return function(msg) {
      logger.debug('Received sync thread message: ' + JSON.stringify(msg));

      switch (msg.message) {
        case 'ready':
          self.emit('THREADREADY');
          break;
        case 'sync':
        default:
          self.threadSync(thread, msg);
      }
    };
  }

  threadSync(thread: Thread, msg: { blockNum: number; notFound?: boolean; error?: Error }) {
    if (msg.error) {
      logger.warn(`Syncing thread ${thread.threadId} returned an error: ${msg.error}`);
    }

    // If last block was found
    if (!msg.notFound) {
      if (this.syncQueue.length > 0) {
        const blockNum = this.syncQueue.shift();
        thread.postMessage({ message: 'sync', blockNum });
      } else {
        thread.postMessage({ message: 'sync', blockNum: this.syncHeight++ }); // syncHeight is incremented until there are no more blocks found
      }
      this.currentHeight = Math.max(msg.blockNum, this.currentHeight);
      this.bestBlock = Math.max(msg.blockNum, this.bestBlock);

      // If the thread didn't find the block for some reason, but we know it exists
    } else if (msg.blockNum < this.bestBlock) {
      thread.postMessage({ message: 'sync', blockNum: msg.blockNum });

      // Otherwise, decrement active syncing threads counter
    } else {
      this.syncingThreads--;
      if (!this.syncingThreads) {
        this.finishSync();
      }
    }
  }

  getWorkerThread(workerData): Thread {
    return new Thread(__dirname + '/syncWorker.js', {
      workerData
    });
  }

  async initializeThreads() {
    if (this.threads.length > 0) {
      return;
    }

    const self = this;
    let threadCnt = this.config.threads || os.cpus().length - 1; // Subtract 1 for this process/thread

    if (threadCnt <= 0) {
      throw new Error('Invalid number of syncing threads.');
    }

    logger.info(`Initializing ${threadCnt} syncing threads.`);
    const workerData = { chain: this.chain, network: this.network };
    for (let i = 0; i < threadCnt; i++) {
      const thread = this.getWorkerThread(workerData);
      this.threads.push(thread);

      thread.on('message', this.threadMessageHandler(thread));

      thread.on('exit', function(code) {
        self.syncingThreads--;
        self.threads.splice(
          self.threads.findIndex(t => t.threadId === thread.threadId),
          1
        );
        if (code !== 0) {
          logger.error('Thread exited with non-zero code', code);
        }
        if (self.threads.length === 0) {
          logger.info('All syncing threads stopped.');
        }
      });
      thread.postMessage({ message: 'start' });
    }
    await new Promise(resolve => this.once('THREADREADY', resolve));
    logger.info('Syncing threads ready.');
  }

  async getVerifiedBlockHeight() {
    const state = await StateStorage.collection.findOne({}, { sort: { _id: -1 } });
    if (
      state &&
      state.verifiedBlockHeight &&
      state.verifiedBlockHeight[this.chain] &&
      state.verifiedBlockHeight[this.chain][this.network]
    ) {
      return state.verifiedBlockHeight[this.chain][this.network];
    }
    return this.config.syncStartHeight || 0;
  }

  async finishSync() {
    clearInterval(this.syncInterval as NodeJS.Timeout);
    if (this.stopping) {
      return;
    }

    const verifiedBlockHeight = await this.getVerifiedBlockHeight();
    logger.info(
      `Verifying ${this.currentHeight - verifiedBlockHeight} ${this.chain}:${
        this.network
      } blocks. This could take a while.`
    );
    const gaps = await EthBlockStorage.getBlockSyncGaps({
      chain: this.chain,
      network: this.network,
      startHeight: verifiedBlockHeight
    });
    logger.info(`Verification of ${this.chain}:${this.network} blocks finished.`);
    if (gaps.length) {
      for (let blockNum of gaps) {
        this.syncBlock(blockNum);
      }
      await StateStorage.collection.updateOne(
        {},
        {
          $set: { [`verifiedBlockHeight.${this.chain}.${this.network}`]: gaps[0] > 100 ? gaps[0] - 100 : 0 }
        },
        { upsert: true }
      );
    } else {
      logger.info(`${this.chain}:${this.network} up to date.`);
      await StateStorage.collection.updateOne(
        {},
        {
          $addToSet: { initialSyncComplete: `${this.chain}:${this.network}` },
          $set: { [`verifiedBlockHeight.${this.chain}.${this.network}`]: this.currentHeight }
        },
        { upsert: true }
      );
      this.emit('INITIALSYNCDONE');
      this.shutdownThreads();
    }
    this.syncing = false;
  }

  shutdownThreads() {
    for (let thread of this.threads) {
      thread.postMessage({ message: 'shutdown' });
    }
    clearInterval(this.syncInterval as NodeJS.Timeout);
  }

  stop() {
    this.shutdownThreads();
    this.stopping = true;
  }
}
