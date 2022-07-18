import { BCHTxProvider } from './bch';
import { BTCTxProvider } from './btc';
import { DOGETxProvider } from './doge';
import { ERC20TxProvider } from './erc20';
import { ETHTxProvider } from './eth';
import { ETHMULTISIGTxProvider } from './eth-multisig';
import { LTCTxProvider } from './ltc';
import { MATICTxProvider } from './matic';
import { MATICERC20TxProvider } from './matic-erc20';
import { MATICMULTISIGTxProvider } from './matic-multisig';
import { XRPTxProvider } from './xrp';

const providers = {
  BTC: new BTCTxProvider(),
  BCH: new BCHTxProvider(),
  ETH: new ETHTxProvider(),
  ETHERC20: new ERC20TxProvider(),
  ETHMULTISIG: new ETHMULTISIGTxProvider(),
  XRP: new XRPTxProvider(),
  DOGE: new DOGETxProvider(),
  LTC: new LTCTxProvider(),
  MATIC: new MATICTxProvider(),
  MATICMULTISIG: new MATICMULTISIGTxProvider(),
  MATICERC20: new MATICERC20TxProvider()
};

export class TransactionsProxy {
  get({ chain }) {
    return providers[chain];
  }

  create(params) {
    return this.get(params).create(params);
  }

  sign(params): string {
    return this.get(params).sign(params);
  }

  getSignature(params): string {
    return this.get(params).getSignature(params);
  }

  applySignature(params) {
    return this.get(params).applySignature(params);
  }

  getHash(params) {
    return this.get(params).getHash(params);
  }
}

export default new TransactionsProxy();
