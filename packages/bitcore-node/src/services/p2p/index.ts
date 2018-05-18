import { IBlock, AddBlockParams, BlockMethodParams } from '../../models/block';
import { BatchImportMethodParams } from '../../models/transaction';
import { CallbackType } from '../../types/Callback';
import { ChainNetwork } from '../../types/ChainNetwork';
import { BtcP2pService } from './bitcoin';
import { SupportedChainSet, SupportedChain } from '../../types/SupportedChain';

import { ISimpleEvent } from 'ste-simple-events';

export interface P2pService {
    // a stream of incoming blocks
    blocks(): ISimpleEvent<BlockEvent>;

    // a stream of incoming transactions
    transactions(): ISimpleEvent<TransactionEvent>;

    // construct a p2p service with a custom config file
    start(): Promise<void>;
}

export interface BlockEvent {
    block: AddBlockParams;
    callback?: CallbackType;
}

export interface TransactionEvent {
    transaction: BatchImportMethodParams;
    callback?: CallbackType;
}

// P2P Workers should never access the database directly, here is a shim.
export interface IP2pState {
    // info of current state of the chain
    getLocalTip(params: BlockMethodParams): Promise<IBlock>;
    getLocatorHashes(params: ChainNetwork): Promise<string[]>;

    // reorganize the chain if we have incorrect blocks
    handleReorg(params: BlockMethodParams): Promise<void>;
}

export function build(
    chain: SupportedChain,
    state: IP2pState,
    config: any
): P2pService {
    const namesToChains: {
        [key in keyof typeof SupportedChainSet]: () => P2pService
    } = {
        BCH: () => new BtcP2pService(state, config),
        BTC: () => new BtcP2pService(state, config),
    };
    return namesToChains[chain]();
}


