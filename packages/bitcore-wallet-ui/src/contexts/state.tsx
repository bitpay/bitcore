import { Wallet } from 'bitcore-client';
export interface AppState {
  walletName: string;
  wallet?: Wallet;
  password: string;
  balance: { confirmed: number; unconfirmed: number; balance: number };
  transactions: any[];
  addresses: string[];
  addressToAdd: string;
  wallets: Wallet[];
}
