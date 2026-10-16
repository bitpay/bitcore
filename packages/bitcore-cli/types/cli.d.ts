import { type Status } from '@bitpay-labs/bitcore-wallet-client';
import { program } from 'commander';
import type { IWallet } from './wallet';

export interface ICliGlobalOptions {
  dir: string;
  help?: boolean;
}

export interface ICliListOptions extends ICliGlobalOptions {
  chain?: string;
  network?: string;
  type?: string;
}

export interface ICliWalletOptions extends ICliGlobalOptions {
  host: string;
  command?: string;
  verbose: boolean;
  exit: boolean;
  pageSize: number;
  wallet?: string;
  walletId?: string;
  register?: boolean; // Register the wallet with the Bitcore Wallet Service if it does not exist
  status?: boolean; // Show status information
  token?: string;
  tokenAddress?: string;
}

export type Program = typeof program;

export interface CommonArgs<MoreOpts = object> {
  wallet: IWallet;
  program?: Program;
  opts?: ICliWalletOptions & MoreOpts;
  status?: Status;
}