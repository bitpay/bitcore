import {
  ARBERC20TxProvider,
  ARBTxProvider
} from './arb';
import {
  BASEERC20TxProvider,
  BASETxProvider
} from './base';
import { BCHTxProvider } from './bch';
import { BTCTxProvider } from './btc';
import { DOGETxProvider } from './doge';
import { ERC20TxProvider } from './erc20';
import { ETHTxProvider } from './eth';
import { ETHMULTISIGTxProvider } from './eth-multisig';
import { LTCTxProvider } from './ltc';
import {
  MATICERC20TxProvider,
  MATICTxProvider
} from './matic';
import { MATICMULTISIGTxProvider } from './matic-multisig';
import { OPERC20TxProvider, OPTxProvider } from './op';
import { SOLTxProvider} from './sol';
import { SPLTxProvider} from './spl';
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
  MATICERC20: new MATICERC20TxProvider(),
  ARB: new ARBTxProvider(),
  ARBERC20: new ARBERC20TxProvider(),
  BASE: new BASETxProvider(),
  BASEERC20: new BASEERC20TxProvider(),
  OP: new OPTxProvider(),
  OPERC20: new OPERC20TxProvider(),
  SOL: new SOLTxProvider(),
  SOLSPL: new SPLTxProvider(),
};

export class TransactionsProxy {
  get({ chain }) {
    const normalizedChain = chain.toUpperCase();
    return providers[normalizedChain];
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

  transformSignatureObject(params) {
    return this.get(params).transformSignatureObject(params);
  }

  getSighash(params): string {
    return this.get(params).getSighash(params);
  }
}

export default new TransactionsProxy();
