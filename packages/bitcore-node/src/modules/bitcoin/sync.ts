import { EventEmitter } from 'events';
import * as os from 'os';
import { Worker as Thread } from 'worker_threads';
import logger, { timestamp } from '../../logger';
import { IUtxoNetworkConfig } from '../../types/Config';
import { BitcoinBlockType, BitcoinHeaderObj } from '../../types/namespaces/Bitcoin';

interface SyncCallbacks {
  getHeaders: () => Promise<BitcoinHeaderObj[]>;
  processBlock: (block: BitcoinBlockType) => Promise<void>;
  getLocalTip: () => Promise<{ height: number } | null>;
  deserializeBlock: (rawHex: string) => BitcoinBlockType;
}

export class UtxoMultiThreadSync extends EventEmitter {
  private chain: string;
  private network: string;
  private threads: Thread[] = [];
  private stopping = false;
  private syncing = false;
  private config: IUtxoNetworkConfig;
  private syncInterval?: NodeJS.Timeout;
  protected currentHeight = 0;

  // Ordered block processing
  private blockBuffer: Map<number, string> = new Map(); // height -> rawBlockHex
  private headerQueue: Array<{ hash: string; height: number }> = [];
  private headerQueueIdx = 0;
  private nextProcessHeight = 0;
  private isProcessing = false;
  private batchResolve?: () => void;
  private batchTargetHeight = 0;
  private callbacks: SyncCallbacks;

  private startHeight = 0;
  private startTime = 0;

  constructor({ chain, network, config, callbacks }: {
    chain: string;
    network: string;
    config: IUtxoNetworkConfig;
    callbacks: SyncCallbacks;
  }) {
    super();
    this.chain = chain;
    this.network = network;
    this.config = config;
    this.callbacks = callbacks;
  }

  async sync() {
    if (this.syncing) return false;
    this.syncing = true;

    const { chain, network } = this;

    try {
      const tip = await this.callbacks.getLocalTip();
      this.currentHeight = tip ? tip.height : this.config.syncStartHeight || 0;
      this.startHeight = this.currentHeight;

      await this.initializeThreads();

      this.startTime = Date.now();
      const oneSecond = 1000;

      this.syncInterval = setInterval(() => {
        const blocksProcessed = this.currentHeight - this.startHeight;
        const elapsedMinutes = (Date.now() - this.startTime) / (60 * oneSecond);
        logger.info(
          `${timestamp()} | MT Syncing... | Chain: ${chain} | Network: ${network} |` +
          `${(blocksProcessed / elapsedMinutes).toFixed(2).padStart(8)} blocks/min | ` +
          `Height: ${this.currentHeight.toString().padStart(7)} | ` +
          `Buffer: ${this.blockBuffer.size} | Threads: ${this.threads.length}`
        );
      }, oneSecond);

      await this.syncLoop();
    } catch (err: any) {
      logger.error(`Error in multi-thread sync for ${chain} ${network}: ${err.message}`);
      this.syncing = false;
      clearInterval(this.syncInterval!);
      throw err;
    }

    return true;
  }

  private async syncLoop() {
    let headers = await this.callbacks.getHeaders();
    while (headers.length > 0 && !this.stopping) {
      const tip = await this.callbacks.getLocalTip();
      const baseHeight = tip ? tip.height : this.config.syncStartHeight || 0;

      // Build header queue with pre-assigned heights
      this.headerQueue = headers.map((h, i) => ({ hash: h.hash, height: baseHeight + 1 + i }));
      this.headerQueueIdx = 0;
      this.nextProcessHeight = baseHeight + 1;
      this.batchTargetHeight = baseHeight + headers.length;

      logger.info(
        `${timestamp()} | MT Syncing ${headers.length} blocks | Chain: ${this.chain} | ` +
        `Network: ${this.network} | Threads: ${this.threads.length}`
      );

      // Kick off all workers
      for (const thread of this.threads) {
        this.assignNextBlock(thread);
      }

      // Wait for all blocks in this header batch to be processed
      await new Promise<void>(resolve => {
        this.batchResolve = resolve;
        // Check if already done (edge case)
        if (this.currentHeight >= this.batchTargetHeight) {
          resolve();
        }
      });

      headers = await this.callbacks.getHeaders();
    }

    this.finishSync();
  }

  private assignNextBlock(thread: Thread) {
    if (this.headerQueueIdx < this.headerQueue.length && !this.stopping) {
      const { hash, height } = this.headerQueue[this.headerQueueIdx++];
      thread.postMessage({ message: 'sync', hash, height });
    }
  }

  threadMessageHandler(thread: Thread) {
    return (msg: any) => {
      if (msg.message === 'ready') {
        this.emit('THREADREADY');
      } else {
        this.onBlockFetched(thread, msg);
      }
    };
  }

  private async onBlockFetched(thread: Thread, msg: any) {
    if (msg.error || msg.notFound) {
      logger.warn(`Sync thread ${msg.threadId} error at height ${msg.height}: ${msg.error || 'not found'}. Retrying.`);
      // Retry the same block
      thread.postMessage({ message: 'sync', hash: msg.hash, height: msg.height });
      return;
    }

    // Buffer the fetched block
    this.blockBuffer.set(msg.height, msg.rawBlock);

    // Process buffered blocks in order
    await this.processOrderedBlocks();

    // Assign next block to this worker
    this.assignNextBlock(thread);
  }

  private async processOrderedBlocks() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      while (this.blockBuffer.has(this.nextProcessHeight) && !this.stopping) {
        const rawHex = this.blockBuffer.get(this.nextProcessHeight)!;
        this.blockBuffer.delete(this.nextProcessHeight);

        const block = this.callbacks.deserializeBlock(rawHex);
        await this.callbacks.processBlock(block);

        this.currentHeight = this.nextProcessHeight;
        this.nextProcessHeight++;

        // Check if batch is complete
        if (this.currentHeight >= this.batchTargetHeight && this.batchResolve) {
          this.batchResolve();
        }
      }
    } catch (err: any) {
      logger.error(`Error processing block at height ${this.nextProcessHeight}: ${err.message}`);
      throw err;
    } finally {
      this.isProcessing = false;
      // Re-check buffer in case blocks arrived while processing
      if (this.blockBuffer.has(this.nextProcessHeight) && !this.stopping) {
        this.processOrderedBlocks();
      }
    }
  }

  getWorkerThread(workerData: any): Thread {
    return new Thread(__dirname + '/syncWorker.js', { workerData });
  }

  async initializeThreads() {
    if (this.threads.length > 0) return;

    const threadCnt = this.config.threads || os.cpus().length - 1;
    if (threadCnt <= 0) {
      throw new Error('Invalid number of syncing threads.');
    }

    logger.info(`Initializing ${threadCnt} UTXO syncing threads for ${this.chain}:${this.network}.`);
    const workerData = { chain: this.chain, network: this.network, rpc: this.config.rpc };

    for (let i = 0; i < threadCnt; i++) {
      const thread = this.getWorkerThread(workerData);
      this.threads.push(thread);

      thread.on('message', this.threadMessageHandler(thread));
      thread.on('exit', (code) => {
        this.threads.splice(
          this.threads.findIndex(t => t.threadId === thread.threadId),
          1
        );
        if (code !== 0) {
          logger.error('UTXO sync thread exited with non-zero code: %o', code);
        }
        if (this.threads.length === 0) {
          logger.info('All UTXO syncing threads stopped.');
        }
      });

      thread.postMessage({ message: 'start' });
    }

    await new Promise(resolve => this.once('THREADREADY', resolve));
    logger.info('UTXO syncing threads ready.');
  }

  private finishSync() {
    clearInterval(this.syncInterval!);
    if (this.stopping) return;

    logger.info(
      `${this.chain}:${this.network} multi-thread sync finished. Switching to single-thread P2P sync.`
    );
    this.emit('INITIALSYNCDONE');
    this.shutdownThreads();
    this.syncing = false;
  }

  shutdownThreads() {
    for (const thread of this.threads) {
      thread.postMessage({ message: 'shutdown' });
    }
    clearInterval(this.syncInterval!);
  }

  stop() {
    this.shutdownThreads();
    this.stopping = true;
  }
}
