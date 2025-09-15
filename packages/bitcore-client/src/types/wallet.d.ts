import { StorageType } from './storage';

export interface IWallet {
  name: string;
  baseUrl: string;
  chain: string;
  network: string;
  path: string;
  phrase?: string;
  xpriv?: string;
  password: string;
  storageType: StorageType;
  addressIndex?: number;
  tokens: Array<any>;
  lite: boolean;
  addressType: string;
  addressZero: string;
}

export interface KeyImport {
  address: string;
  privKey?: string;
  pubKey?: string;
  path?: string;
}

export interface BumpTxFeeType {
  txid?: string;
  rawTx?: string;
  changeIdx?: number;
  feeRate?: number;
  feeTarget?: number;
  feePriority?: number;
  noRbf?: boolean;
  isSweep?: boolean;
}
