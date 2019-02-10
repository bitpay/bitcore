import { Wallet } from 'bitcore-client';
export interface AppState {
  walletName: string;
  wallet?: Wallet;
  password: string;
  balance: { confirmed: number; unconfirmed: number; balance: number };
  transactions: any[];
  addresses: string[];
  addressToAdd: string;
  message: string;
  open: boolean;
  postReducer: Function;
}
const State = {
  password: '',
  walletName: '',
  balance: {
    confirmed: 0,
    unconfirmed: 0,
    balance: 0
  },
  transactions: [],
  addresses: [],
  addressToAdd: '',
  message: '',
  open: false
};
