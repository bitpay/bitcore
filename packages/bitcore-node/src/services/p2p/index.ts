import logger from '../../logger';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { ChainNetwork } from '../../types/ChainNetwork';
import { IBlockModel } from '../../models/block';
import { sleep } from '../../utils/async';
import { ITransactionModel } from '../../models/transaction';
import { SupportedChain, SupportedChainSet } from '../../types/SupportedChain';
import { BtcP2pService } from './bitcoin';
import { Bitcoin } from '../../types/namespaces/Bitcoin';


export interface P2pService<Block, Transaction> {
  // a stream of incoming blocks
  blocks(): Observable<{
    block: Block,
    transactions: Transaction[]
  }>;

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


export async function setupSync(
  chainnet: ChainNetwork,
  blocks: IBlockModel,
  service: StandardP2p
) {
  service.syncing = true;
  const parent = service.parent();
  const tip = () => blocks.getLocalTip({
    chain: chainnet.chain,
    network: chainnet.network
  });

  return {
    // sync the main chain
    async start(): Promise<void> {
      // get best block we currently have to see if we're synced
      let bestBlock = await tip();

      // wait for the parent fork to sync first
      if (parent && bestBlock.height < parent.height) {
        logger.info(`Waiting until ${parent.chain} syncs before ${chainnet.chain}`);
        do {
          await sleep(5000);
          bestBlock = await tip();
        }
        while (bestBlock.height < parent.height);
      }

      if (bestBlock.height !== service.height()) {
        logger.info(
          `Syncing from ${bestBlock.height} to ${service.height()} for chain ${
            chainnet.chain
        }`);

        const locators = await blocks.getLocatorHashes(chainnet);
        logger.debug(`Received ${locators.length} headers`);

        // TODO: what if this happens after add(this.end)?
        this.end = await service.sync(locators);
      }
      else {
        logger.info(`${chainnet.chain} up to date.`);
        service.syncing = false;
        this.end = undefined;
      }
    },
    // notify syncing service that a hash has been added to the db
    add(hash: string): undefined | Promise<void> {
      if (hash && hash === this.end) {
        return this.start();
      }
      return undefined;
    },
    end: undefined as (undefined | string),
  }
}


export async function init(
  chainnet: ChainNetwork,
  blocks: IBlockModel,
  transactions: ITransactionModel,
  service: StandardP2p
) {
  logger.debug(`Started worker for chain ${chainnet.chain}`);
  const parent = service.parent();
  const sync = await setupSync(chainnet, blocks, service);

  service.blocks().pipe(concatMap(async pair => {
    await blocks.addBlock({
      chain: chainnet.chain,
      network: chainnet.network,
      forkHeight: parent? parent.height : 0,
      parentChain: parent? parent.chain : chainnet.chain,
      block: pair.block
    });
    logger.debug(`Added block ${pair.block.hash}`, chainnet);
    sync.add(pair.block.hash);
  }))
  .subscribe(() => {}, logger.error.bind(logger));

  service.transactions().pipe(concatMap(async transaction => {
    await transactions.batchImport({
      txs: [transaction],
      height: -1,
      network: chainnet.network,
      chain: chainnet.chain,
      blockTime: new Date(),
      blockTimeNormalized: new Date(),
    });
    logger.debug(`Added transaction ${transaction.hash}`, chainnet);
  }))
  .subscribe(() => {}, logger.error.bind(logger));

  // wait for it to get connected
  await service.start();
  sync.start();
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


