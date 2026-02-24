// src/providers/chain-state/external/adapters/IIndexedAPIAdapter.ts

import { IEVMTransactionTransformed } from '../../evm/types';
import { ExternalApiStream } from '../streams/apiStream';
import {
  StreamWalletTransactionsArgs
} from '../../../../types/namespaces/ChainStateProvider';

export interface IIndexedAPIAdapter {
  /** Provider display name (e.g., 'Moralis', 'Alchemy') */
  readonly name: string;

  /** Chains this adapter supports (e.g., ['ETH', 'MATIC', 'BASE']) */
  readonly supportedChains: string[];

  /**
   * Get a single transaction by hash.
   * Returns the transaction in internal format, or undefined if not found.
   * MUST NOT throw for "not found" — return undefined instead.
   * MUST throw AdapterError subclasses for all other failures.
   */
  getTransaction(params: AdapterTransactionParams): Promise<IEVMTransactionTransformed | undefined>;

  /**
   * Stream address transactions. Returns an ExternalApiStream that handles
   * pagination internally and emits transformed transactions.
   */
  streamAddressTransactions(params: AdapterStreamParams): ExternalApiStream;

  /**
   * Stream ERC20 token transfers for an address.
   * Returns an ExternalApiStream of transformed token transfer transactions.
   */
  streamERC20Transfers(params: AdapterStreamParams & { tokenAddress: string }): ExternalApiStream;

  /**
   * Get block number closest to the given date.
   */
  getBlockNumberByDate(params: AdapterBlockByDateParams): Promise<number>;

  /**
   * Lightweight health check. Should complete within 5 seconds.
   */
  healthCheck(): Promise<boolean>;
}

// Adapter-specific param types (decoupled from CSP param types)
export interface AdapterTransactionParams {
  chain: string;
  network: string;
  chainId: string | bigint;
  txId: string;
}

export interface AdapterStreamParams {
  chain: string;
  network: string;
  chainId: string | bigint;
  address: string;
  args: StreamWalletTransactionsArgs & {
    tipHeight?: number;
    tokenAddress?: string;
    pageSize?: number;
    transform?: (data: any) => any;
  };
}

export interface AdapterBlockByDateParams {
  chain: string;
  network: string;
  chainId: string | bigint;
  date: Date;
}
