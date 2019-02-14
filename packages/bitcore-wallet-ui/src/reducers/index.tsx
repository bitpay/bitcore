import { ImmerReducer } from 'immer-reducer';
import { AppState } from '../contexts/state';
import { Wallet } from 'bitcore-client';

export class MyImmerReducer extends ImmerReducer<AppState> {
  setWallet(wallet: Wallet) {
    this.draftState.wallet = wallet;
  }
  setWallets(wallet: Wallet) {
    const walletNames = this.state.wallets.map(w => w.name);
    if (!walletNames.includes(wallet.name))
      this.draftState.wallets = [...this.state.wallets, wallet];
  }
  setWalletName(name: string) {
    this.draftState.walletName = name;
  }
  setMessage(message: string) {
    this.draftState.message = message;
  }
  // Need to import ITransaction[] type here
  setTransactions(txList: AppState['transactions']) {
    this.draftState.transactions = txList;
  }
  setAddress(address: AppState['addressToAdd']) {
    this.draftState.addresses = [...this.state.addresses, address];
  }
  setBalance(balance: AppState['balance']) {
    this.draftState.balance = balance;
  }
  setAddressToAdd(address: string) {
    this.draftState.addressToAdd = address;
  }
  setPassword(password: string) {
    this.draftState.password = password;
  }
}
