import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { MongoBound } from '../../models/base';
import { IBlock } from '../../models/baseBlock';
import { IBtcBlock } from '../../models/block';
import { ICoin } from '../../models/coin';
import { ITransaction } from '../../models/transaction';
import { IWallet } from '../../models/wallet';
import { StreamingFindOptions } from '../../services/storage';
import { ChainNetwork } from '../../types/ChainNetwork';
import { AuthheadJSON } from '../Authhead';
import { CoinListingJSON } from '../Coin';
import { DailyTransactionsJSON } from '../stats';
export type StreamWalletTransactionsArgs = {
  startBlock: number;
  endBlock: number;
  startDate: string;
  endDate: string;
  includeMempool: boolean;
} & StreamingFindOptions<ITransaction>;

export interface StreamAddressUtxosArgs {
  unspent: boolean;
}

export interface GetBlockArgs {
  limit: null | number;
}

export interface PubKey {
  pubKey: string;
}

export type GetBalanceForAddressParams = ChainNetwork & {
  address: string;
  args: any;
};

export type GetBlockParams = ChainNetwork & {
  blockId?: string;
  sinceBlock?: number | string;
  args?: Partial<{ startDate: Date; endDate: Date; date: Date } & StreamingFindOptions<IBtcBlock>>;
};

export type GetBlockBeforeTimeParams = ChainNetwork & {
  time?: Date | string;
};

export type StreamBlocksParams = ChainNetwork & {
  blockId?: string;
  sinceBlock: number | string;
  args?: Partial<{ startDate: Date; endDate: Date; date: Date } & StreamingFindOptions<IBtcBlock>>;
  req: Request;
  res: Response;
};
export type GetEstimateSmartFeeParams = ChainNetwork & {
  target: number;
};
export type BroadcastTransactionParams = ChainNetwork & {
  rawTx: string | Array<string>;
};
export type CreateWalletParams = IWallet;
export type GetWalletParams = ChainNetwork & PubKey;

export type UpdateWalletParams = ChainNetwork & {
  wallet: MongoBound<IWallet>;
  addresses: string[];
};

export type GetWalletBalanceParams = ChainNetwork & {
  wallet: MongoBound<IWallet>;
  args: any;
};

export type GetWalletBalanceAtTimeParams = ChainNetwork & {
  wallet: MongoBound<IWallet>;
  time: string;
  args: any;
};

export type StreamAddressUtxosParams = ChainNetwork & {
  address: string;
  req?: Request;
  res?: Response;
  args: Partial<StreamAddressUtxosArgs & StreamingFindOptions<ICoin> & any>;
};

export type StreamTransactionsParams = ChainNetwork & {
  req: Request;
  res: Response;
  args: any;
};
export type StreamTransactionParams = ChainNetwork & {
  txId: string;
};
export type StreamWalletAddressesParams = ChainNetwork & {
  walletId: ObjectId;
  req: Request;
  res: Response;
  limit: number;
};

export type DailyTransactionsParams = ChainNetwork & {
  startDate: string;
  endDate: string;
};

export type WalletCheckParams = ChainNetwork & {
  wallet: ObjectId;
};

export type StreamWalletMissingAddressesParams = ChainNetwork & {
  pubKey: string;
  req: Request;
  res: Response;
};

export type StreamWalletTransactionsParams = ChainNetwork & {
  wallet: MongoBound<IWallet>;
  req: Request;
  res: Response;
  args: StreamWalletTransactionsArgs & any;
};
export interface StreamWalletUtxosArgs {
  includeSpent: 'true' | undefined;
}
export type StreamWalletUtxosParams = ChainNetwork & {
  wallet: MongoBound<IWallet>;
  limit: number;
  args: Partial<StreamWalletUtxosArgs>;
  req: Request;
  res: Response;
};

export type isValidParams = ChainNetwork & {
  input: string;
};

export interface GetCoinsForTxParams {
  chain: string;
  network: string;
  txid: string;
}

export interface Provider<T> {
  get(params: { chain: string }): T;
}
export type IChainStateProvider = Provider<IChainStateService> & IChainStateService;
export interface IChainStateService {
  getBalanceForAddress(
    params: GetBalanceForAddressParams
  ): Promise<{ confirmed: number; unconfirmed: number; balance: number }>;
  getBlock(params: GetBlockParams): Promise<IBlock>;
  getBlockBeforeTime(params: GetBlockBeforeTimeParams): Promise<IBlock>;
  streamBlocks(params: StreamBlocksParams): any;
  getFee(params: GetEstimateSmartFeeParams): any;
  broadcastTransaction(params: BroadcastTransactionParams): Promise<any>;
  createWallet(params: CreateWalletParams): Promise<IWallet>;
  getWallet(params: GetWalletParams): Promise<IWallet | null>;
  updateWallet(params: UpdateWalletParams): Promise<void>;
  getWalletBalance(
    params: GetWalletBalanceParams
  ): Promise<{ confirmed: number; unconfirmed: number; balance: number }>;
  getWalletBalanceAtTime(
    params: GetWalletBalanceAtTimeParams
  ): Promise<{ confirmed: number; unconfirmed: number; balance: number }>;
  streamAddressUtxos(params: StreamAddressUtxosParams): any;
  streamAddressTransactions(params: StreamAddressUtxosParams): any;
  streamTransactions(params: StreamTransactionsParams): any;
  getAuthhead(params: StreamTransactionParams): Promise<AuthheadJSON | undefined>;
  getDailyTransactions(params: DailyTransactionsParams): Promise<DailyTransactionsJSON>;
  getTransaction(params: StreamTransactionParams): Promise<any | undefined>;
  streamWalletAddresses(params: StreamWalletAddressesParams): any;
  walletCheck(params: WalletCheckParams): any;
  streamWalletTransactions(params: StreamWalletTransactionsParams): any;
  streamWalletUtxos(params: StreamWalletUtxosParams): any;
  streamMissingWalletAddresses(params: StreamWalletMissingAddressesParams);
  getCoinsForTx(params: GetCoinsForTxParams): Promise<CoinListingJSON>;
  getLocalTip(params): Promise<IBlock | null>;
  getLocatorHashes(params): Promise<any>;
  isValid(params: isValidParams): { isValid: boolean; type: string };
}

export interface ChainStateServices {
  [key: string]: IChainStateService;
}
