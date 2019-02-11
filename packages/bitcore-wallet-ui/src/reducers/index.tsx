import { ImmerReducer } from 'immer-reducer';
import { AppState } from '../contexts/state';
import { Wallet } from 'bitcore-client';

export class MyImmerReducer extends ImmerReducer<AppState> {
  setWallet(wallet: Wallet) {
    this.draftState.wallet = wallet;
  }

  setWallets(wallet: Wallet) {
    this.draftState.wallets = [...this.state.wallets, wallet];
  }
}
