import { Wallet } from 'bitcore-client';
export interface AppState {
  walletName: string;
  wallet?: Wallet;
  password: string;
  balance: {
    confirmed: number;
    unconfirmed: number;
    balance: number;
  };
  transactions: {
    address: string;
    blockTime: string;
    category: string;
    fee: number;
    height: number;
    id: string;
    outputIndex: number;
    satoshis: number;
    size: number;
    txid: string;
  }[];
  addresses: string[];
  addressToAdd: string;
  wallets: Wallet[];
  unlocked: boolean;
}
