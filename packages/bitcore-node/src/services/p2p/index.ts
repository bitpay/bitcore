import logger from '../../logger';
import config from '../../config';
import { isChainSupported } from '../../types/SupportedChain';
import { BlockModel } from '../../models/block';
import { TransactionModel } from '../../models/transaction';
import { Observable } from 'rxjs';
import { concatMap, share } from 'rxjs/operators';
import { ChainNetwork, Chain } from '../../types/ChainNetwork';
import { Block } from '../../models/block';
import { sleep } from '../../utils/async';
import { Transaction } from '../../models/transaction';
import { BtcP2pService } from './bitcoin';
import { Bitcoin } from '../../types/namespaces/Bitcoin';
import { CSP } from '../../types/namespaces/ChainStateProvider';
import { setImmediate } from 'timers';
import { EventEmitter } from 'events';
import { LoggifyClass } from '../../decorators/Loggify';
import { Prefetcher } from "../../utils/prefetcher";

const P2PClasses: {
  [key: string]: Class<StandardP2p>;
} = {
  BCH: BtcP2pService,
  BTC: BtcP2pService
};

export interface P2pService<Block, Transaction> {
  // a stream of incoming blocks
  blocks(): Observable<CompleteBlock<Block, Transaction>>;

  // a stream of incoming transactions
  transactions(): Observable<Transaction>;

  // connect to the peers and begin emitting data
  start(): Promise<void>;

  // sync data from previous history according to these hashes
  // returns the hash of the last block synced
  sync(locatorHashes: string[]): Promise<string | undefined>;

  // get the max height of every peer in the pool
  height(): number;

  // get information about the chain this forked from (if applicable)
  parent(): ChainNetwork & { height: number } | undefined;

  // disconnects from peer and stops all pending tasks,
  // afterwards `start()` can be called again.
  stop(): Promise<void>;

  // when `true` only emit blocks that result from the syncing process
  syncing: boolean;

  getMissingBlockHashes(hashes: string[]): Promise<{hash: string}[]>;
  getBlock(hash: string): Promise<Block>;
}

export type StandardP2p = P2pService<Bitcoin.Block, Bitcoin.Transaction>;
type ChainSyncer = {
  add: (string) => void;
  start: () => Promise<any>;
};

export type CompleteBlock<B, T> = {
  block: B;
  transactions: T[];
};

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
  private blockPrefetcher: Prefetcher<string, Promise<Bitcoin.Block>> | null = null;

  constructor(
    chain: string,
    network: string,
    blocks: Block,
    transactions: Transaction,
    service: StandardP2p
  ) {
    this.service = service;
    this.chain = chain;
    this.network = network;
    this.blocks = blocks;
    this.transactions = transactions;
    this.events = new EventEmitter();
  }

  private async wireupBlockStream(
    syncer: ChainSyncer,
    parent?: { height: number; chain: string }
  ) {
    return this.service
      .blocks()
      .pipe(
        concatMap(async pair => {
          await this.blocks.addBlock({
            chain: this.chain,
            network: this.network,
            forkHeight: parent ? parent.height : 0,
            parentChain: parent ? parent.chain : this.chain,
            block: pair.block
          });
          if (this.service.syncing) {
            syncer.add(pair.block.hash);
          } else {
            logger.info(`Added block ${pair.block.hash}`, {
              chain: this.chain,
              network: this.network
            });
          }
          return pair;
        })
      )
      .pipe(share());
  }

  private async wireupTxStream() {
    return this.service
      .transactions()
      .pipe(
        concatMap(async transaction => {
          await this.transactions.batchImport({
            txs: [transaction],
            height: -1,
            network: this.network,
            chain: this.chain,
            blockTime: new Date(),
            blockTimeNormalized: new Date()
          });
          logger.debug(`Added transaction ${transaction.hash}`, {
            chain: this.chain,
            network: this.network
          });
          return transaction;
        })
      )
      .pipe(share());
  }

  async start(): Promise<{
    blocks: Observable<CompleteBlock<Bitcoin.Block, Bitcoin.Transaction>>;
    transactions: Observable<Bitcoin.Transaction>;
  }> {
    logger.debug(`Started worker for chain ${this.chain}`);
    const parent = this.service.parent();
    const syncer = await this.sync();

    const blocks = await this.wireupBlockStream(syncer, parent);
    blocks.subscribe(() => {}, logger.error.bind(logger));

    const txs = await this.wireupTxStream();
    txs.subscribe(() => {}, logger.error.bind(logger));

    // wait for it to get connected
    await this.service.start();
    syncer.start();
    return {
      blocks,
      transactions: txs
    };
  }


  async getBlock(hash: string): Promise<Bitcoin.Block> {
    if(this.blockPrefetcher) {
      return this.blockPrefetcher.get(hash)
    }
    return this.service.getBlock(hash);
  }

  async sync(): Promise<ChainSyncer> {
    this.service.syncing = true;
    const parent = this.service.parent();
    const tip = () =>
    this.blocks.getLocalTip({
      chain: this.chain,
      network: this.network
    });
    let finished = false;
    let finalHash;
    let recentHash;
    let goalHeight;
    let counter = 0;
    let lastLog = 0;

    // remove the previous block to ensure consistency through process termination
    await this.blocks.handleReorg({chain: this.chain, network: this.network });

    // sync the main chain
    const start = async () => {

      // get best block we currently have to see if we're synced
      let bestBlock = await tip();

      // wait for the parent fork to sync first
      if (parent && bestBlock.height < parent.height) {
        logger.info(`Waiting until ${parent.chain} syncs before ${this.chain}`);
        do {
          await sleep(5000);
          bestBlock = await tip();
        } while (bestBlock.height < parent.height);
      }

      counter = bestBlock.height;
      goalHeight = this.service.height();
      if (bestBlock.height !== goalHeight) {
        logger.info(
          `Syncing from ${
            bestBlock.height
          } to ${this.service.height()} for chain ${this.chain}`
        );

        const locators = await this.blocks.getLocatorHashes({
          chain: this.chain,
          network: this.network
        });
        logger.debug(`Received ${locators.length} headers`);

        const headers = await this.service.getMissingBlockHashes(locators);
        finalHash = headers[headers.length -1].hash;
        let hashes = headers.map(h => h.hash);
        this.blockPrefetcher = new Prefetcher(hashes, 10, this.service.getBlock, this.service);
        for (const hash of hashes) {
          const block = await this.getBlock(hash);
          logger.debug('Block received', block.hash);
          await this.blocks.addBlock({
            chain: this.chain,
            network: this.network,
            forkHeight: parent ? parent.height : 0,
            parentChain: parent ? parent.chain : this.chain,
            block: block
          });
          if (this.service.syncing) {
            if (finished || !goalHeight) {
              return;
            }
            logger.debug(`Syncing block ${block.hash}`, {
              chain: this.chain,
              network: this.network
            });
            counter += 1;
            if (Date.now() - lastLog > 100) {
              logger.info(
                `Sync progress ${(counter * 100 / goalHeight).toFixed(3)}%`,
                {
                  chain: this.chain,
                  network: this.network,
                  height: counter
                }
              );
              lastLog = Date.now();
            }
            if (block.hash === finalHash) {
              start();
            } else {
              recentHash = block.hash;
            }
          } else {
            logger.info(`Added block ${block.hash}`, {
              chain: this.chain,
              network: this.network
            });
          }
        }

        if (finalHash && recentHash === finalHash) {
          setImmediate(() => start());
        }
      } else {
        logger.info(`${this.chain}:${this.network} up to date.`);
        this.service.syncing = false;
        finished = true;
        this.events.emit(P2pEvents.SYNC_COMPLETE, true);
      }
    };

    // notify syncing service that a hash has been added to the db
    return {
      add: (hash: string) => {
        if (finished || !goalHeight) {
          return;
        }
        logger.debug(`Syncing block ${hash}`, {
          chain: this.chain,
          network: this.network
        });
        counter += 1;
        if (Date.now() - lastLog > 100) {
          logger.info(
            `Sync progress ${(counter * 100 / goalHeight).toFixed(3)}%`,
            {
              chain: this.chain,
              network: this.network,
              height: counter
            }
          );
          lastLog = Date.now();
        }
        if (hash === finalHash) {
          start();
        } else {
          recentHash = hash;
        }
      },
      start
    };
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

  build(params: {
    chain: string;
    network: string;
    blocks: Block;
    transactions: Transaction;
    config: any;
  }): P2pRunner {
    logger.debug(`Building p2p service for ${params.chain}.`);
    const P2PClass = this.get(params);
    const chainP2PConnection = new P2PClass(params.config);
    const runner = new P2pRunner(
      params.chain,
      params.network,
      params.blocks,
      params.transactions,
      chainP2PConnection
    );
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
