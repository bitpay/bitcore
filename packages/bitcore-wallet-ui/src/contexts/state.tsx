import { Wallet } from 'bitcore-client';
import { ICoin } from 'bitcore-node';
export interface AppState {
  walletName: string;
  wallet?: Wallet;
  password: string;
  balance: { confirmed: number; unconfirmed: number; balance: number };
  transactions: ICoin[];
  addresses: string[];
  addressToAdd: string;
  wallets: Wallet[];
  unlocked: boolean;
}
