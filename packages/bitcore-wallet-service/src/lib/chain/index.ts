import { Common } from '../common';
import { ITxProposal, IWallet, TxProposal } from '../model';
import { WalletService } from '../server';
import { BchChain } from './bch';
import { BtcChain } from './btc';
import { DogeChain } from './doge';
import { EthChain } from './eth';
import { LtcChain } from './ltc';
import { MaticChain } from './matic';
import { XrpChain } from './xrp';

const Constants = Common.Constants;
const Defaults = Common.Defaults;

export interface INotificationData {
  out: {
    address: any;
    amount: any;
    tokenAddress?: any;
  };
  txid: any;
}

export interface IChain {
  getWalletBalance(server: WalletService, wallet: IWallet, opts: { coin: string; addresses: string[] } & any, cb);
  getWalletSendMaxInfo(
    server: WalletService,
    wallet: IWallet,
    opts: {
      excludeUnconfirmedUtxos: string;
      returnInputs: string;
      from: string;
      feePerKb: number;
      useProUrl: boolean;
    } & any,
    cb
  );
  getInputSizeSafetyMargin(opts: any): number;
  getSizeSafetyMargin(opts: any): number;
  getDustAmountValue();
  getTransactionCount(server: WalletService, wallet: IWallet, from: string);
  getChangeAddress(server: WalletService, wallet: IWallet, opts: { changeAddress: string } & any);
  checkDust(output: { amount: number; toAddress: string; valid: boolean }, opts: { outputs: any[] } & any);
  getFee(server: WalletService, wallet: IWallet, opts: { fee: number; feePerKb: number } & any);
  getBitcoreTx(txp: TxProposal, opts: { signed: boolean });
  convertFeePerKb(p: number, feePerKb: number);
  checkTx(server: WalletService, txp: ITxProposal);
  checkTxUTXOs(server: WalletService, txp: ITxProposal, opts: { noCashAddr: boolean } & any, cb);
  selectTxInputs(server: WalletService, txp: ITxProposal, wallet: IWallet, opts: { utxosToExclude: any[] } & any, cb);
  checkUtxos(opts: { fee: number; inputs: any[] });
  checkValidTxAmount(output): boolean;
  isUTXOChain(): boolean;
  isSingleAddress(): boolean;
  supportsMultisig(): boolean;
  notifyConfirmations(network: string): boolean;
  addSignaturesToBitcoreTx(
    tx: string,
    inputs: any[],
    inputPaths: any[],
    signatures: any[],
    xpub: string,
    signingMethod?: string
  );
  addressToStorageTransform(network: string, address: {}): void;
  addressFromStorageTransform(network: string, address: {}): void;
  validateAddress(wallet: IWallet, inaddr: string, opts: { noCashAddr: boolean } & any);
  onCoin(coin: any): INotificationData | null;
  onTx(tx: any): INotificationData | null;
}

const chains: { [chain: string]: IChain } = {
  BTC: new BtcChain(),
  BCH: new BchChain(),
  ETH: new EthChain(),
  MATIC: new MaticChain(),
  XRP: new XrpChain(),
  DOGE: new DogeChain(),
  LTC: new LtcChain()
};

class ChainProxy {
  get(chain: string) {
    const normalizedChain = chain.toUpperCase();
    return chains[normalizedChain];
  }

  /**
   * @deprecated
   */
  getChain(coin: string): string {
    try {
      // TODO add a warning that we are not including chain
      let normalizedChain = coin.toLowerCase();
      if (
        Constants.BITPAY_SUPPORTED_ETH_ERC20[normalizedChain.toUpperCase()] ||
        !Constants.CHAINS[normalizedChain.toUpperCase()]
      ) {
        // default to eth if it's an ETH ERC20 or if we don't know the chain
        normalizedChain = 'eth';
      }
      return normalizedChain;
    } catch (err) {
      return Defaults.CHAIN; // coin should always exist but most unit test don't have it -> return btc as default
    }
  }

  getWalletBalance(server, wallet, opts, cb) {
    return this.get(wallet.chain).getWalletBalance(server, wallet, opts, cb);
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    return this.get(wallet.chain).getWalletSendMaxInfo(server, wallet, opts, cb);
  }

  getDustAmountValue(chain) {
    return this.get(chain).getDustAmountValue();
  }

  getTransactionCount(server, wallet, from) {
    return this.get(wallet.chain).getTransactionCount(server, wallet, from);
  }

  getChangeAddress(server, wallet, opts) {
    return this.get(wallet.chain).getChangeAddress(server, wallet, opts);
  }

  checkDust(chain, output, opts) {
    return this.get(chain).checkDust(output, opts);
  }

  getFee(server, wallet, opts) {
    return this.get(wallet.chain).getFee(server, wallet, opts);
  }

  getBitcoreTx(txp: TxProposal, opts = { signed: true }) {
    return this.get(txp.chain).getBitcoreTx(txp, { signed: opts.signed });
  }

  convertFeePerKb(chain, p, feePerKb) {
    return this.get(chain).convertFeePerKb(p, feePerKb);
  }

  addressToStorageTransform(chain, network, address) {
    return this.get(chain).addressToStorageTransform(network, address);
  }

  addressFromStorageTransform(chain, network, address) {
    return this.get(chain).addressFromStorageTransform(network, address);
  }

  checkTx(server, txp) {
    return this.get(txp.chain).checkTx(server, txp);
  }

  checkTxUTXOs(server, txp, opts, cb) {
    return this.get(txp.chain).checkTxUTXOs(server, txp, opts, cb);
  }

  selectTxInputs(server, txp, wallet, opts, cb) {
    return this.get(txp.chain).selectTxInputs(server, txp, wallet, opts, cb);
  }

  checkUtxos(chain, opts) {
    return this.get(chain).checkUtxos(opts);
  }

  checkValidTxAmount(chain: string, output): boolean {
    return this.get(chain).checkValidTxAmount(output);
  }

  isUTXOChain(chain: string): boolean {
    return this.get(chain).isUTXOChain();
  }

  isSingleAddress(chain: string): boolean {
    return this.get(chain).isSingleAddress();
  }

  notifyConfirmations(chain: string, network: string): boolean {
    return this.get(chain).notifyConfirmations(network);
  }

  supportsMultisig(chain: string): boolean {
    return this.get(chain).supportsMultisig();
  }

  addSignaturesToBitcoreTx(chain, tx, inputs, inputPaths, signatures, xpub, signingMethod) {
    this.get(chain).addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub, signingMethod);
  }

  validateAddress(wallet, inaddr, opts) {
    return this.get(wallet.chain).validateAddress(wallet, inaddr, opts);
  }

  onCoin(chain: string, coinData: any) {
    return this.get(chain).onCoin(coinData);
  }

  onTx(chain: string, tx: any) {
    return this.get(chain).onTx(tx);
  }
}

export let ChainService = new ChainProxy();
