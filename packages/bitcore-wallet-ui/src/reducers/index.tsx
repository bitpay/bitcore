import { ImmerReducer } from 'immer-reducer';
import { AppState } from '../contexts/state';
import { Wallet } from 'bitcore-client';

export class MyImmerReducer extends ImmerReducer<AppState> {
  setWallet(wallet: Wallet | undefined) {
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
  // Need to import ITransaction[] type here
  setTransactions(txList: AppState['transactions']) {
    this.draftState.transactions = txList;
  }
  setAddress(address: AppState['addressToAdd']) {
    const prevAddress = this.state.addresses.map(e => e);
    if (!prevAddress.includes(address)) {
      this.draftState.addresses = [...this.state.addresses, address];
    }
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
