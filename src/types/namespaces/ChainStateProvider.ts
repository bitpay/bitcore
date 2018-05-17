import { IBlock } from "../../models/block";
import { Response } from "express";
import { IWalletModel, IWallet, IWalletDoc } from "../../models/wallet";
import { ChainNetwork } from "../../types/ChainNetwork";
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
    blockId: string;
  };
  export type GetBlocksParams = ChainNetwork & {
    sinceBlock: number | string;
    args: { limit: number };
  };
  export type BroadcastTransactionParams = ChainNetwork & {
    rawTx: string;
  };
  export type CreateWalletParams = IWallet;
  export type GetWalletParams = ChainNetwork & PubKey;

  export type UpdateWalletParams = ChainNetwork & {
    wallet: IWalletModel;
    addresses: string[];
  };

  export type GetWalletBalanceParams = ChainNetwork & {
    wallet: IWalletModel
  }

  export type StreamAddressUtxosParams = ChainNetwork & {
    address: string;
    stream: Response;
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
    walletId: IWalletModel;
    stream: Response;
  };
  export type StreamWalletTransactionsParams = ChainNetwork & {
    wallet: IWalletModel;
    stream: Response;
    args: StreamWalletTransactionsArgs;
  };
  export type StreamWalletUtxosArgs = { includeSpent: "true" | undefined };
  export type StreamWalletUtxosParams = ChainNetwork & {
    wallet: IWalletModel;
    args: Partial<StreamWalletUtxosArgs>;
    stream: Response;
  };

  export type Provider<T> = { get(params: { chain: string }): T };
  export type ChainStateProvider = Provider<IChainStateService> &
    IChainStateService;
  export interface IChainStateService {
    getBalanceForAddress(params: GetBalanceForAddressParams): Promise<{balance: number}[]>;
    getBalanceForWallet(params: GetBalanceForWalletParams): Promise<{balance: number}[]>;
    getBlock(params: GetBlockParams): Promise<IBlock>;
    getBlocks(params: GetBlocksParams): Promise<IBlock[]>;
    broadcastTransaction(params: BroadcastTransactionParams): Promise<any>;
    createWallet(params: CreateWalletParams): Promise<IWalletDoc>;
    getWallet(params: GetWalletParams): Promise<IWalletDoc | null>;
    updateWallet(params: UpdateWalletParams): Promise<IWalletModel>;
    getWalletBalance(params: GetWalletBalanceParams): Promise<{balance: number}[]>;
    streamAddressUtxos(params: StreamAddressUtxosParams): any;
    streamTransactions(params: StreamTransactionsParams): any;
    streamTransaction(params: StreamTransactionParams): any;
    streamWalletAddresses(params: StreamWalletAddressesParams): any;
    streamWalletTransactions(params: StreamWalletTransactionsParams): any;
    streamWalletUtxos(params: StreamWalletUtxosParams): any;
  }

  type ChainStateServices = { [key: string]: IChainStateService };
}

