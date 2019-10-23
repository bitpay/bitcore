import { ITxProposal, IWallet } from '../model';
import { WalletService } from '../server';
import { BchChain } from './bch';
import { BtcChain } from './btc';
import { EthChain } from './eth';

export interface IChain {
  getWalletBalance(server: WalletService, wallet: IWallet, opts: {coin: string, addresses: string[]} & any, cb);
  getWalletSendMaxInfo(server: WalletService, wallet: IWallet, opts: {excludeUnconfirmedUtxos: string, returnInputs: string, from: string, feePerKb: number} & any, cb);
  getDustAmountValue();
  getTransactionCount(server: WalletService, wallet: IWallet, from: string);
  getChangeAddress(server: WalletService, wallet: IWallet, opts: {changeAddress: string} & any);
  checkErrorOutputs(output: {amount: number, toAddress: string, valid: boolean}, opts: {outputs: any[]} & any);
  getFeePerKb(server: WalletService, wallet: IWallet, opts: {fee: number, feePerKb: number} & any);
  getLevelsFee(p: number, feePerKb: number);
  checkTx(server: WalletService, txp: ITxProposal);
  storeAndNotifyTx(server: WalletService, txp: ITxProposal, opts: {noCashAddr: boolean} & any, cb);
  selectTxInputs(server: WalletService, txp: ITxProposal, wallet: IWallet, opts: {utxosToExclude: any[]} & any, cb, next);
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

  getWalletBalance(server, wallet, opts, cb) {
    return this.get(wallet.coin).getWalletBalance(server, wallet, opts, cb);
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    return this.get(wallet.coin).getWalletSendMaxInfo(server, wallet, opts, cb);
  }

  getDustAmountValue(coin) {
    return this.get(coin).getDustAmountValue();
  }

  getTransactionCount(server, wallet, from) {
    return this.get(wallet.coin).getTransactionCount(server, wallet, from);
  }

  getChangeAddress(server, wallet, opts) {
    return this.get(wallet.coin).getChangeAddress(server, wallet, opts);
  }

  checkErrorOutputs(coin, output, opts) {
    return this.get(coin).checkErrorOutputs(output, opts);
  }

  getFeePerKb(server, wallet, opts) {
    return this.get(wallet.coin).getFeePerKb(server, wallet, opts);
  }

  getLevelsFee(coin, p, feePerKb) {
    return this.get(coin).getLevelsFee(p, feePerKb);
  }

  checkTx(server, txp) {
    return this.get(txp.coin).checkTx(server, txp);
  }

  storeAndNotifyTx(server, txp, opts, cb) {
    return this.get(txp.coin).storeAndNotifyTx(server, txp, opts, cb);
  }

  selectTxInputs(server, txp, wallet, opts, cb, next) {
    return this.get(txp.coin).selectTxInputs(server, txp, wallet, opts, cb, next);
  }
}

export let ChainService = new ChainProxy();
