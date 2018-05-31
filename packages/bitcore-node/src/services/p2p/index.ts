import logger from '../../logger';
import config from '../../config';
import { isChainSupported } from '../../types/SupportedChain';
import { BlockModel } from '../../models/block';
import { TransactionModel } from '../../models/transaction';
import { Observable } from 'rxjs';
import { concatMap, share } from 'rxjs/operators';
import { ChainNetwork } from '../../types/ChainNetwork';
import { IBlockModel } from '../../models/block';
import { sleep } from '../../utils/async';
import { ITransactionModel } from '../../models/transaction';
import { SupportedChain, SupportedChainSet } from '../../types/SupportedChain';
import { BtcP2pService } from './bitcoin';
import { Bitcoin } from '../../types/namespaces/Bitcoin';
import { setImmediate } from 'timers';
import { EventEmitter } from 'events';


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
}


export type StandardP2p = P2pService<Bitcoin.Block, Bitcoin.Transaction>;


export type CompleteBlock<B, T> = {
  block: B,
  transactions: T[],
};


export enum P2pEvents {
  SYNC_COMPLETE = 'SYNC_COMPLETE',
}


export class P2pRunner {
  private service: StandardP2p;
  private chain: string;
  private network: string;
  private blocks: IBlockModel;
  private transactions: ITransactionModel;

  public events: EventEmitter;

  constructor(
    chain: string,
    network: string,
    blocks: IBlockModel,
    transactions: ITransactionModel,
    service: StandardP2p
  ) {
    this.service = service;
    this.chain = chain;
    this.network = network;
    this.blocks = blocks;
    this.transactions = transactions;
    this.events = new EventEmitter();
  }

  async start(): Promise<{
    blocks: Observable<CompleteBlock<Bitcoin.Block, Bitcoin.Transaction>>,
    transactions: Observable<Bitcoin.Transaction>,
  }> {
    logger.debug(`Started worker for chain ${this.chain}`);
    const parent = this.service.parent();
    const syncer = await this.sync();

    const blocks = this.service.blocks().pipe(concatMap(async pair => {
      await this.blocks.addBlock({
        chain: this.chain,
        network: this.network,
        forkHeight: parent? parent.height : 0,
        parentChain: parent? parent.chain : this.chain,
        block: pair.block
      });
      if (this.service.syncing) {
        syncer.add(pair.block.hash);
      }
      else {
        logger.info(`Added block ${pair.block.hash}`, {
          chain: this.chain,
          network: this.network,
        });
      }
      return pair;
    })).pipe(share());
    blocks.subscribe(() => {}, logger.error.bind(logger));

    const txs = this.service.transactions().pipe(concatMap(async transaction => {
      await this.transactions.batchImport({
        txs: [transaction],
        height: -1,
        network: this.network,
        chain: this.chain,
        blockTime: new Date(),
        blockTimeNormalized: new Date(),
      });
      logger.debug(`Added transaction ${transaction.hash}`, {
        chain: this.chain,
        network: this.network,
      });
      return transaction;
    })).pipe(share());
    txs.subscribe(() => {}, logger.error.bind(logger));

    // wait for it to get connected
    await this.service.start();
    syncer.start();
    return {
      blocks,
      transactions: txs,
    };
  }

  async sync() {
    this.service.syncing = true;
    const parent = this.service.parent();
    const tip = () => this.blocks.getLocalTip({
      chain: this.chain,
      network: this.network
    });
    let finished = false;
    let finalHash;
    let recentHash;
    let goalHeight;
    let counter = 0;
    let lastLog = 0;

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
        }
        while (bestBlock.height < parent.height);
      }

      counter = bestBlock.height;
      goalHeight = this.service.height();
      if (bestBlock.height !== goalHeight) {
        logger.info(
          `Syncing from ${bestBlock.height} to ${this.service.height()} for chain ${
          this.chain
        }`);

        const locators = await this.blocks.getLocatorHashes({
          chain: this.chain,
          network: this.network
        });
        logger.debug(`Received ${locators.length} headers`);

        finalHash = await this.service.sync(locators);
        if (finalHash && recentHash === finalHash) {
          setImmediate(() => start());
        }
      }
      else {
        logger.info(`${this.chain} up to date.`);
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
          logger.info(`Sync progress ${(counter * 100 / goalHeight).toFixed(3)}%`, {
            chain: this.chain,
            network: this.network,
            height: counter
          });
          lastLog = Date.now();
        }
        if (hash === finalHash) {
          start();
        }
        else {
          recentHash = hash;
        }
      },
      start,
    };
  }
}


export function build(
  chain: SupportedChain,
  config: any
): StandardP2p {
  const namesToChains: {
    [key in keyof typeof SupportedChainSet]: () => StandardP2p
  } = {
    BCH: () => new BtcP2pService(config),
    BTC: () => new BtcP2pService(config),
  };
  logger.debug(`Building p2p service for ${chain}.`)
  return namesToChains[chain]();
}


export async function start() {
  const p2pServices: (() => Promise<any>)[] = [];
  for (let chain of Object.keys(config.chains)) {
    for (let network of Object.keys(config.chains[chain])) {
      const chainConfig = config.chains[chain][network];
      const hasChainSource = chainConfig.chainSource !== undefined;
      const isP2p = chainConfig.chainSource === 'p2p';

      if (isChainSupported(chain) && (!hasChainSource || isP2p)) {
        let p2pServiceConfig = Object.assign(
          config.chains[chain][network],
          { chain, network }
        );

        // build the correct service for the chain
        const built = build(chain, p2pServiceConfig);
        const service = new P2pRunner(chain, network, BlockModel, TransactionModel, built);

        // get ready to start the service
        p2pServices.push(() => service.start());
      }
    }
  }
  await Promise.all(p2pServices.map(w => w()));
}
