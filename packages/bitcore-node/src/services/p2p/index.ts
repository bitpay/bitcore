import logger from '../../logger';
import config from '../../config';
import { isChainSupported } from '../../types/SupportedChain';
import { BlockModel } from '../../models/block';
import { TransactionModel } from '../../models/transaction';
import { ChainNetwork, Chain } from '../../types/ChainNetwork';
import { Block } from '../../models/block';
import { sleep } from '../../utils/async';
import { Transaction } from '../../models/transaction';
import { BtcP2pService } from './bitcoin';
import { Bitcoin } from '../../types/namespaces/Bitcoin';
import { CSP } from '../../types/namespaces/ChainStateProvider';
import { EventEmitter } from 'events';
import { LoggifyClass } from '../../decorators/Loggify';

const P2PClasses: {
  [key: string]: Class<StandardP2p>;
} = {
  BCH: BtcP2pService,
  BTC: BtcP2pService
};

export interface P2pService<Block> {
  // a stream of blocks and transactions
  stream: EventEmitter;

  // connect to the peers and begin emitting data
  start(): Promise<void>;

  // get the max height of every peer in the pool
  height(): number;

  // get information about the chain this forked from (if applicable)
  parent(): ChainNetwork & { height: number } | undefined;

  // disconnects from peer and stops all pending tasks,
  // afterwards `start()` can be called again.
  stop(): Promise<void>;

  // when `true` only emit blocks that result from the syncing process
  syncing: boolean;

  // Get block hashes from a list of headers
  getMissingBlockHashes(hashes: string[]): Promise<string[]>;

  // Get a block from its hash
  getBlock(hash: string): Promise<Block>;
}

export type StandardP2p = P2pService<Bitcoin.Block>;

export enum P2pEvents {
  SYNC_COMPLETE = 'SYNC_COMPLETE'
}

@LoggifyClass
export class P2pRunner {
  private service: StandardP2p;
  private chain: string;
  private network: string;
  private blocks: Block;
  private transactions: Transaction;

  public events: EventEmitter;

  constructor(chain: string, network: string, blocks: Block, transactions: Transaction, service: StandardP2p) {
    this.service = service;
    this.chain = chain;
    this.network = network;
    this.blocks = blocks;
    this.transactions = transactions;
    this.events = new EventEmitter();
  }

  private wireupBlockStream(parent?: { height: number; chain: string }) {
    this.service.stream.on('block', async (block: Bitcoin.Block) => {
      await this.blocks.addBlock({
        chain: this.chain,
        network: this.network,
        forkHeight: parent ? parent.height : 0,
        parentChain: parent ? parent.chain : this.chain,
        block: block
      });
      logger.info(`Added block ${block.hash}`, {
        chain: this.chain,
        network: this.network
      });
    });
  }

  private wireupTxStream() {
    this.service.stream.on('tx', async (tx: Bitcoin.Transaction) => {
      await this.transactions.batchImport({
        txs: [tx],
        height: -1,
        network: this.network,
        chain: this.chain,
        mempoolTime: new Date(),
      });
      logger.debug(`Added transaction ${tx.hash}`, {
        chain: this.chain,
        network: this.network
      });
    });
  }

  async start() {
    logger.debug(`Started worker for chain ${this.chain}`);
    const parent = this.service.parent();
    this.service.syncing = true;
    this.wireupBlockStream(parent);
    this.wireupTxStream();
    // wait for it to get connected
    await this.service.start();
    await this.sync();
  }

  async sync() {
    this.service.syncing = true;
    const parent = this.service.parent();
    const tip = () =>
      this.blocks.getLocalTip({
        chain: this.chain,
        network: this.network
      });

    // remove the previous block to ensure consistency through process termination
    await this.blocks.handleReorg({ chain: this.chain, network: this.network });

    // get best block we currently have to see if we're synced
    let bestBlock = await tip();

    // wait for the parent fork to sync first
    while (parent && bestBlock.height < parent.height) {
      logger.info(`Waiting until ${parent.chain} syncs before ${this.chain}`);
      await sleep(5000);
      bestBlock = await tip();
    }

    const getHeaders = async () => {
      const locators = await this.blocks.getLocatorHashes({
        chain: this.chain,
        network: this.network
      });
      logger.debug(`Received ${locators.length} headers`);

      return this.service.getMissingBlockHashes(locators);
    };

    let hashes;
    while (!hashes || hashes.length > 0) {
      hashes = await getHeaders();
      bestBlock = await tip();
      let lastLog = 0;
      let counter = bestBlock.height;
      logger.info(
        `Syncing from ${
        bestBlock.height
        } to ${this.service.height()} for chain ${this.chain}`
      );

      for (const hash of hashes) {
        const block = await this.service.getBlock(hash);
        logger.debug('Block received', block.hash);
        await this.blocks.addBlock({
          chain: this.chain,
          network: this.network,
          forkHeight: parent ? parent.height : 0,
          parentChain: parent ? parent.chain : this.chain,
          block
        });
        logger.debug(`Syncing block ${block.hash}`, {
          chain: this.chain,
          network: this.network
        });
        counter += 1;
        if (Date.now() - lastLog > 100) {
          logger.info(`Sync progress ${((counter * 100) / this.service.height()).toFixed(3)}%`, {
            chain: this.chain,
            network: this.network,
            height: counter
          });
          lastLog = Date.now();
        }
      }
    }
    logger.info(`${this.chain}:${this.network} up to date.`);
    this.service.syncing = false;
    this.events.emit(P2pEvents.SYNC_COMPLETE, true);
  }
}

export class P2pProxy implements CSP.Provider<Class<StandardP2p>> {
  get({ chain }: Chain): Class<StandardP2p> {
    if (P2PClasses[chain]) {
      return P2PClasses[chain];
    }
    throw new Error(`Chain ${chain} doesn't have a P2P Worker registered`);
  }

  register(chain: string, service: Class<StandardP2p>) {
    P2PClasses[chain] = service;
  }

  build(params: { chain: string; network: string; blocks: Block; transactions: Transaction; config: any }): P2pRunner {
    logger.debug(`Building p2p service for ${params.chain}.`);
    const P2PClass = this.get(params);
    const chainP2PConnection = new P2PClass(params.config);
    const runner = new P2pRunner(params.chain, params.network, params.blocks, params.transactions, chainP2PConnection);
    return runner;
  }

  async startConfiguredChains() {
    const p2pServices: Promise<any>[] = [];
    for (let chain of Object.keys(config.chains)) {
      for (let network of Object.keys(config.chains[chain])) {
        const chainConfig = config.chains[chain][network];
        const hasChainSource = chainConfig.chainSource !== undefined;
        const isP2p = chainConfig.chainSource === 'p2p';

        if (isChainSupported(chain) && (!hasChainSource || isP2p)) {
          let p2pServiceConfig = Object.assign(config.chains[chain][network], {
            chain,
            network
          });

          // build the correct service for the chain
          const runner = this.build({
            chain,
            network,
            blocks: BlockModel,
            transactions: TransactionModel,
            config: p2pServiceConfig
          });

          // get ready to start the service
          p2pServices.push(runner.start());
        }
      }
    }
    await Promise.all(p2pServices);
  }
}

export const P2pProvider = new P2pProxy();
