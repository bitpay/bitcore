import { IBlock } from '../../models/block';
import { Response } from 'express';
import { IWallet } from '../../models/wallet';
import { ChainNetwork } from '../../types/ChainNetwork';
import { StreamingFindOptions } from "../../services/storage";
export declare namespace CSP {
  export type StreamWalletTransactionsArgs = {
    startBlock: number;
    endBlock: number;
    startDate: Date;
    endDate: Date;
  };

  export type StreamAddressUtxosArgs = {
    unspent: boolean;
  };

  export type GetBlockArgs = { limit: null | number };

  export type PubKey = { pubKey: string };

  export type GetBalanceForAddressParams = ChainNetwork & {
    address: string;
  };
  export type GetBalanceForWalletParams = ChainNetwork & {
    walletId: string;
  };
  export type GetBlockParams = ChainNetwork & {
    blockId?: string;
    sinceBlock?: number | string;
    args?: Partial<{ startDate: Date; endDate: Date; date: Date;} & StreamingFindOptions<IBlock>>;
  };
  export type StreamBlocksParams = ChainNetwork & {
    blockId?: string;
    sinceBlock?: number | string;
    args?: Partial<{ startDate: Date; endDate: Date; date: Date;} & StreamingFindOptions<IBlock>>;
    stream: Response;
  };
  export type GetEstimateSmartFeeParams = ChainNetwork & {
    target: number;
  };
  export type BroadcastTransactionParams = ChainNetwork & {
    rawTx: string;
  };
  export type CreateWalletParams = IWallet;
  export type GetWalletParams = ChainNetwork & PubKey;

  export type UpdateWalletParams = ChainNetwork & {
    wallet: IWallet;
    addresses: string[];
  };

  export type GetWalletBalanceParams = ChainNetwork & {
    wallet: IWallet;
  };

  export type StreamAddressUtxosParams = ChainNetwork & {
    address: string;
    stream: Response;
    limit: number;
    args: StreamAddressUtxosArgs;
  };

  export type StreamTransactionsParams = ChainNetwork & {
    stream: Response;
    args: any;
  };
  export type StreamTransactionParams = ChainNetwork & {
    txId: string;
    stream: Response;
  };
  export type StreamWalletAddressesParams = ChainNetwork & {
    walletId: IWallet;
    stream: Response;
    limit: number;
  };
  export type StreamWalletTransactionsParams = ChainNetwork & {
    wallet: IWallet;
    stream: Response;
    args: StreamWalletTransactionsArgs;
  };
  export type StreamWalletUtxosArgs = { includeSpent: 'true' | undefined };
  export type StreamWalletUtxosParams = ChainNetwork & {
    wallet: IWallet;
    limit: number;
    args: Partial<StreamWalletUtxosArgs>;
    stream: Response;
  };

  export type Provider<T> = { get(params: { chain: string }): T };
  export type ChainStateProvider = Provider<IChainStateService> & IChainStateService;
  export interface IChainStateService {
    getBalanceForAddress(params: GetBalanceForAddressParams): Promise<{ balance: number }[]>;
    getBalanceForWallet(params: GetBalanceForWalletParams): Promise<{ balance: number }[]>;
    getBlock(params: GetBlockParams): Promise<IBlock | string>;
    streamBlocks(param: StreamBlocksParams): any;
    getFee(params: GetEstimateSmartFeeParams): any;
    broadcastTransaction(params: BroadcastTransactionParams): Promise<any>;
    createWallet(params: CreateWalletParams): Promise<IWallet>;
    getWallet(params: GetWalletParams): Promise<IWallet | null>;
    updateWallet(params: UpdateWalletParams): Promise<{}>;
    getWalletBalance(params: GetWalletBalanceParams): Promise<{ balance: number }[]>;
    streamAddressUtxos(params: StreamAddressUtxosParams): any;
    streamAddressTransactions(params: StreamAddressUtxosParams): any;
    streamTransactions(params: StreamTransactionsParams): any;
    streamTransaction(params: StreamTransactionParams): any;
    streamWalletAddresses(params: StreamWalletAddressesParams): any;
    streamWalletTransactions(params: StreamWalletTransactionsParams): any;
    streamWalletUtxos(params: StreamWalletUtxosParams): any;
    getCoinsForTx(params: { chain: string; network: string; txid: string }): Promise<any>;
    getLocalTip(params): Promise<any>;
    getLocatorHashes(params): Promise<any>
  }

  type ChainStateServices = { [key: string]: IChainStateService };
}
