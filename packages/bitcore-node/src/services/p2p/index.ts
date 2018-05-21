import logger from '../../logger';
import { Observable } from 'rxjs';
import { map as rxmap } from 'rxjs/operators';
import { ChainNetwork } from '../../types/ChainNetwork';
import { IBlockModel, IBlock } from '../../models/block';
import { sleep } from '../../utils/async';
import { ITransaction, ITransactionModel } from '../../models/transaction';
import { SupportedChain, SupportedChainSet } from '../../types/SupportedChain';


export interface P2pService<Block, Transaction> {
  // a stream of incoming blocks
  blocks(): Observable<Block>;

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


export type StandardP2p = P2pService<IBlock, ITransaction>;


export function map<B1, T1, B2, T2>(
  service: P2pService<B1, T1>,
  mapBlocks: (B1) => B2,
  mapTrans: (T1) => T2
): P2pService<B2, T2> {
  return {
    blocks: () => service.blocks().pipe(rxmap(mapBlocks)),
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
  service.blocks().subscribe(block => {
    blocks.addBlock(block);
  }, err => {
    // TODO: better error logs
    logger.error(err);
  });

  service.transactions().subscribe(transaction => {
    transactions.batchImport(transaction)
  }, err => {
    // TODO: better error logs
    logger.error(err);
  });

  await service.start();

  // check if already synced
  const parent = service.parent();
  let bestBlock = await blocks.getLocalTip({
      chain: chainnet.chain,
      network: chainnet.network
  });

  // wait for the parent fork to sync first
  if (parent && bestBlock.height < parent.height) {
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
    return namesToChains[chain]();
}


