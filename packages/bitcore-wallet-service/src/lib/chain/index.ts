import { BchChain } from './bch';
import { BtcChain } from './btc';
import { EthChain } from './eth';

export interface IChain {
  getWalletBalance(opts: any, cb);
  getWalletSendMaxInfo(wallet: any, opts: any, cb);
  getDustAmountValue();
  getTransactionCount(wallet: any, from: string);
  getChangeAddress(wallet: any, opts: any);
  checkErrorOutputs(output, opts: any);
  getFeePerKb(wallet: any, opts: any);
  getLevelsFee(p: number, feePerKb: number);
  checkTx(txp: any);
  storeAndNotifyTx(txp: any, opts: any, cb);
  selectTxInputs(txp: any, wallet: any, opts: any, cb, next);
}

const chain: { [chain: string]: IChain } = {
  BTC: new BtcChain(),
  BCH: new BchChain(),
  ETH: new EthChain()
};

class ChainProxy {
  get(coin) {
    const normalizedChain = coin.toUpperCase();
    return chain[normalizedChain];
  }

  getWalletBalance(opts, cb) {
    return this.get(opts.wallet.coin).getWalletBalance(opts, cb);
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