import logger from '../../logger';
import { Observable } from 'rxjs';
import { map as rxmap } from 'rxjs/operators';
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
  sync(locatorHashes: string[]): Promise<void>;

  // get the max height of every peer in the pool
  height(): number;

  // get information about the chain this forked from (if applicable)
  parent(): ChainNetwork & { height: number } | undefined;

  // disconnects from peer and stops all pending tasks,
  // afterwards `start()` can be called again.
  stop(): Promise<void>;
}


export type StandardP2p = P2pService<Bitcoin.Block, Bitcoin.Transaction>;


export function map<B1, T1, B2, T2>(
  service: P2pService<B1, T1>,
  mapBlocks: (B1) => B2,
  mapTrans: (T1) => T2
): P2pService<B2, T2> {
  return {
    blocks: () => service.blocks().pipe(rxmap(b => {
      return {
        block: mapBlocks(b.block),
        transactions: b.transactions.map(mapTrans),
      };
    })),
    transactions: () => service.blocks().pipe(rxmap(mapTrans)),
    start: service.start.bind(service),
    sync: service.sync.bind(service),
    height: service.height.bind(service),
    parent: service.parent.bind(service),
    stop: service.stop.bind(service),
  };
}


export async function init(
  chainnet: ChainNetwork,
  blocks: IBlockModel,
  transactions: ITransactionModel,
  service: StandardP2p
) {
  logger.debug(`Started worker for chain ${chainnet.chain}`);
  const parent = service.parent();

  // TODO: queue up messages
  service.blocks().subscribe(async pair => {
    await blocks.addBlock({
      chain: chainnet.chain,
      network: chainnet.network,
      forkHeight: parent? parent.height : 0,
      parentChain: parent? parent.chain : chainnet.chain,
      block: pair.block
    });
    logger.debug(`Added block ${pair.block.hash}`, chainnet);
  }, logger.error.bind(logger));

  service.transactions().subscribe(transaction => {
    transactions.batchImport({
      txs: [transaction],
      height: -1,
      network: chainnet.network,
      chain: chainnet.chain,
      blockTime: new Date(),
      blockTimeNormalized: new Date(),
    });
  }, logger.error.bind(logger));

  // wait for it to get connected
  await service.start();

  // check if already synced
  let bestBlock = await blocks.getLocalTip({
      chain: chainnet.chain,
      network: chainnet.network
  });

  // wait for the parent fork to sync first
  if (parent && bestBlock.height < parent.height) {
    logger.info(`Waiting until ${parent.chain} syncs before ${chainnet.chain}`);
    do {
      await sleep(5000);
      bestBlock = await blocks.getLocalTip({
        chain: chainnet.chain,
        network: chainnet.network
      });
    }
    while (bestBlock.height < parent.height);
  }

  // sync the main chain
  if (bestBlock.height !== service.height()) {
    logger.info(
      `Syncing from ${bestBlock.height} to ${service.height()} for chain ${
        chainnet.chain
    }`);

    const locators = await blocks.getLocatorHashes(chainnet);
    logger.debug(`Received ${locators.length} headers`);

    await service.sync(locators);
  }
  else {
    logger.info(`${chainnet.chain} up to date, not syncing.`);
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


