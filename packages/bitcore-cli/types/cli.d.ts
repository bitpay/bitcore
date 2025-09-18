import { program } from 'commander';
import { type Status } from 'bitcore-wallet-client';
import type { IWallet } from './wallet';

export interface ICliOptions {
  dir: string;
  host: string;
  command?: string;
  verbose: boolean;
  exit: boolean;
  pageSize: number;
  wallet?: string;
  walletId?: string;
  register?: boolean; // Register the wallet with the Bitcore Wallet Service if it does not exist
  help?: boolean;
  status?: boolean; // Show status information
  token?: string;
  tokenAddress?: string;
}

export type Program = typeof program;

export interface CommonArgs<MoreOpts = {}> {
  wallet: IWallet;
  program?: Program;
  opts?: ICliOptions & MoreOpts;
  status?: Status;
}