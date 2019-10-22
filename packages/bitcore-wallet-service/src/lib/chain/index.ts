import { ITxProposal, IWallet } from '../model';
import { WalletService } from '../server';
import { BchChain } from './bch';
import { BtcChain } from './btc';
import { EthChain } from './eth';

export interface IChain {
  init(server: WalletService);
  getWalletBalance(wallet: IWallet, opts: {coin: string, addresses: string[]} & any, cb);
  getWalletSendMaxInfo(wallet: IWallet, opts: {excludeUnconfirmedUtxos: string, returnInputs: string, from: string, feePerKb: number} & any, cb);
  getDustAmountValue();
  getTransactionCount(wallet: IWallet, from: string);
  getChangeAddress(wallet: IWallet, opts: {changeAddress: string} & any);
  checkErrorOutputs(output: {amount: number, toAddress: string, valid: boolean}, opts: {outputs: any[]} & any);
  getFeePerKb(wallet: IWallet, opts: {fee: number, feePerKb: number} & any);
  getLevelsFee(p: number, feePerKb: number);
  checkTx(txp: ITxProposal);
  storeAndNotifyTx(txp: ITxProposal, opts: {noCashAddr: boolean} & any, cb);
  selectTxInputs(txp: ITxProposal, wallet: IWallet, opts: {utxosToExclude: any[]} & any, cb, next);
}

const chain: { [chain: string]: IChain } = {
  BTC: new BtcChain(),
  BCH: new BchChain(),
  ETH: new EthChain()
};

class ChainProxy {
  init(server: WalletService) {
    for (let proxy of Object.values(chain)) {
      proxy.init(server);
    }
  }
  get(coin) {
    const normalizedChain = coin.toUpperCase();
    return chain[normalizedChain];
  }

  getWalletBalance(wallet, opts, cb) {
    return this.get(wallet.coin).getWalletBalance(wallet, opts, cb);
  }

  getWalletSendMaxInfo(wallet, opts, cb) {
    return this.get(wallet.coin).getWalletSendMaxInfo(wallet, opts, cb);
  }

  getDustAmountValue(coin) {
    return this.get(coin).getDustAmountValue();
  }

  getTransactionCount(wallet, from) {
    return this.get(wallet.coin).getTransactionCount(wallet, from);
  }

  getChangeAddress(wallet, opts) {
    return this.get(wallet.coin).getChangeAddress(wallet, opts);
  }

  checkErrorOutputs(coin, output, opts) {
    return this.get(coin).checkErrorOutputs(output, opts);
  }

  getFeePerKb(wallet, opts) {
    return this.get(wallet.coin).getFeePerKb(wallet, opts);
  }

  getLevelsFee(coin, p, feePerKb) {
    return this.get(coin).getLevelsFee(p, feePerKb);
  }

  checkTx(txp) {
    return this.get(txp.coin).checkTx(txp);
  }

  storeAndNotifyTx(txp, opts, cb) {
    return this.get(txp.coin).storeAndNotifyTx(txp, opts, cb);
  }

  selectTxInputs(txp, wallet, opts, cb, next) {
    return this.get(txp.coin).selectTxInputs(txp, wallet, opts, cb, next);
  }
}

export let ChainService = new ChainProxy();
