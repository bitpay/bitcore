import {
  API,
  Credentials,
  Key,
  type Network,
  TssKey,
  TssSign,
  Txp
} from 'bitcore-wallet-client';
import { type Types as CWCTypes } from 'crypto-wallet-core';

export type KeyType = Key;
export type ClientType = API;
export type TssKeyType = TssKey.TssKey;
export type TssSigType = TssSign.ISignature;


export interface WalletData {
  key: KeyType | TssKeyType;
  creds: Credentials;
}

export interface IWallet {
  name: string;
  dir: string;
  filename: string;
  host: string;
  walletId: string;
  client: ClientType;
  isFullyEncrypted?: boolean;
  chain: string;
  network: Network;

  getClient(args: {
    mustBeNew?: boolean;
    mustExist?: boolean;
    doNotComplete?: boolean
  }): Promise<ClientType>;
  create(args: {
    coin?: string;
    chain: string;
    network: Network;
    copayerName: string;
    account: number;
    n: number;
    m?: number;
    mnemonic?: string;
    password?: string;
    addressType?: string;
  }): Promise<{ key: KeyType | TssKeyType; secret?: string; creds: Credentials }>;
  createFromTss(args: {
    key: TssKeyType;
    chain: string;
    network: Network;
    password: string;
    addressType?: string;
    copayerName: string;
  }): Promise<{ key: TssKeyType; creds: Credentials }>;
  register(args: { copayerName: string; }): Promise<string | undefined>;
  load(opts?: { doNotComplete?: boolean; allowCache?: boolean; }): Promise<KeyType | TssKeyType>;
  save(opts?: { encryptAll?: boolean; }): Promise<void>;
  export(args: {
    filename: string;
    exportPassword?: string;
  }): Promise<void>;
  import(args: {
    filename: string;
    importPassword?: string;
  }): Promise<void>;
  isComplete(): boolean;
  getToken(args: { token?: string; tokenAddress?: string }): Promise<ITokenObj>;
  getTokenByAddress(args: { tokenAddress: string }): Promise<ITokenObj>;
  getTokenByName(args: { token: string }): Promise<ITokenObj>;
  getTokenFromChain(args: { address: string }): Promise<ITokenObj>;
  getNativeCurrency(fallback?: boolean): Promise<ITokenObj | null>;
  getPasswordWithRetry(): Promise<string>;
  signTxp(args: { txp: Txp }): Promise<Array<string>>;
  signAndBroadcastTxp(args: { txp: Txp; }): Promise<Txp>;
  signMessage(args: {
    message: string;
    derivationPath: string;
    encoding?: BufferEncoding | 'base58';
  }): Promise<CWCTypes.Message.ISignedMessage>;
  getXPrivKey(password?: string): Promise<string>;
  getXPubKey(): string;
  isMultiSig(): boolean;
  isTss(): boolean;
  getMinSigners(): number;
  isWalletEncrypted(): boolean;
  isUtxo(): boolean;
  isEvm(): boolean;
  isSvm(): boolean;
  isXrp(): boolean;
  isTokenChain(): boolean;
}

export interface ITokenObj {
  alts: string;
  chain: string;
  code: string;
  contractAddress?: string;
  decimals: {
    full: { maxDecimals: number; minDecimals: number };
    short: { maxDecimals: number; minDecimals: number };
  };
  precision: number;
  toSatoshis: number;
  displayCode: string;
  maxSupply: number;
  minimum: number;
  name: string;
  plural: string;
  sanctioned?: boolean;
  symbol: string;
  trancheDecimals: number;
  native: boolean;
}