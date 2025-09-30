import { IChain } from '../../types/chain';
import { Common } from '../common';
import { IWallet, TxProposal } from '../model';
import { WalletService } from '../server';
import logger from './../logger';
import { ArbChain } from './arb';
import { BaseChain } from './base';
import { BchChain } from './bch';
import { BtcChain } from './btc';
import { DogeChain } from './doge';
import { EthChain } from './eth';
import { LtcChain } from './ltc';
import { MaticChain } from './matic';
import { OpChain } from './op';
import { SolChain } from './sol';
import { XrpChain } from './xrp';

const Constants = Common.Constants;
const Defaults = Common.Defaults;

const chains: { [chain: string]: IChain } = {
  BTC: new BtcChain(),
  BCH: new BchChain(),
  ETH: new EthChain(),
  MATIC: new MaticChain(),
  ARB: new ArbChain(),
  BASE: new BaseChain(),
  OP: new OpChain(),
  XRP: new XrpChain(),
  DOGE: new DogeChain(),
  LTC: new LtcChain(),
  SOL: new SolChain()
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
      if (coin === undefined) { // This happens frequently for very old btc wallets/addresses
        return Defaults.CHAIN;
      }
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
      logger.error(`Error getting chain for coin ${coin}: %o`, err.stack || err.message || err);
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

  checkScriptOutput(chain, output) {
    return this.get(chain).checkScriptOutput(output);
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

  supportsThresholdsig(chain: string): boolean {
    return this.get(chain).supportsThresholdsig();
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

  getReserve(server: WalletService, wallet: IWallet, cb: (err?, reserve?: number) => void) {
    return this.get(wallet.chain).getReserve(server, wallet, cb);
  }

  refreshTxData(server, txp, opts, cb) {
    return this.get(txp.chain).refreshTxData(server, txp, opts, cb);
  }
}

export let ChainService = new ChainProxy();
