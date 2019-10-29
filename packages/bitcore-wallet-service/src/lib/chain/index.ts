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
  checkDust(output: {amount: number, toAddress: string, valid: boolean}, opts: {outputs: any[]} & any);
  getFee(server: WalletService, wallet: IWallet, opts: {fee: number, feePerKb: number} & any);
  convertFeePerKb(p: number, feePerKb: number);
  checkTx(server: WalletService, txp: ITxProposal);
  checkTxUTXOs(server: WalletService, txp: ITxProposal, opts: {noCashAddr: boolean} & any, cb);
  selectTxInputs(server: WalletService, txp: ITxProposal, wallet: IWallet, opts: {utxosToExclude: any[]} & any, cb, next);
  checkUtxos(opts: { fee: number, inputs: any[]});
  setInputs(info: {inputs: any[]});
  isUTXOCoin();
  isSingleAddress();
  addSignaturesToBitcoreTx(tx: string, inputs: any[], inputPaths: any[], signatures: any[], xpub: string);
  addressToStorageTransform(network: string, address: {}): void;
  addressFromStorageTransform(network: string, address: {}): void;
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

  checkDust(coin, output, opts) {
    return this.get(coin).checkDust(output, opts);
  }

  getFee(server, wallet, opts) {
    return this.get(wallet.coin).getFee(server, wallet, opts);
  }

  convertFeePerKb(coin, p, feePerKb) {
    return this.get(coin).convertFeePerKb(p, feePerKb);
  }

  addressToStorageTransform(coin, network, address) {
    return this.get(coin).addressToStorageTransform(network, address);
  }

  addressFromStorageTransform(coin, network, address) {
    return this.get(coin).addressFromStorageTransform(network, address);
  }

  checkTx(server, txp) {
    return this.get(txp.coin).checkTx(server, txp);
  }

  checkTxUTXOs(server, txp, opts, cb) {
    return this.get(txp.coin).checkTxUTXOs(server, txp, opts, cb);
  }

  selectTxInputs(server, txp, wallet, opts, cb, next) {
    return this.get(txp.coin).selectTxInputs(server, txp, wallet, opts, cb, next);
  }

  checkUtxos(coin, opts) {
    return this.get(coin).checkUtxos(opts);
  }

  setInputs(coin, info) {
    return this.get(coin).setInputs(info);
  }

  isUTXOCoin(coin) {
    return this.get(coin).isUTXOCoin();
  }

  isSingleAddress(coin) {
    return this.get(coin).isSingleAddress();
  }

  addSignaturesToBitcoreTx(coin, tx, inputs, inputPaths, signatures, xpub) {
    return this.get(coin).addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub);
  }
}

export let ChainService = new ChainProxy();
