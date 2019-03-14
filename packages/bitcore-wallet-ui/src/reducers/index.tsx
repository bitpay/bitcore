import { ImmerReducer } from 'immer-reducer';
import { AppState } from '../types/state';
import { Wallet } from 'bitcore-client';

export class MyImmerReducer extends ImmerReducer<AppState> {
  setWallet(wallet: Wallet | undefined) {
    this.draftState.wallet = wallet;
  }
  setUnlocked(unlocked: boolean) {
    this.draftState.unlocked = unlocked;
  }
  setWallets(wallet: Wallet) {
    const walletNames = this.state.wallets.map(w => w.name);
    if (!walletNames.includes(wallet.name))
      this.draftState.wallets = [...this.state.wallets, wallet];
  }
  setWalletName(name: string) {
    this.draftState.walletName = name;
  }
  setTransactions(txList: AppState['transactions']) {
    this.draftState.transactions = txList;
  }
  setAddress(address: AppState['addressToAdd']) {
    const prevAddress = this.state.addresses.map(e => e);
    if (!prevAddress.includes(address)) {
      this.draftState.addresses = [...prevAddress, address];
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
