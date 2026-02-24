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
import { SOLTxProvider } from './sol';
import { SPLTxProvider } from './spl';
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
  /**
   * Returns the list of supported chain/token identifiers.
   *
   * @returns {string[]} Array of supported chain names (uppercase)
   */
  getSupportedChains(): string[] {
    return Object.keys(providers);
  }

  /**
   * Returns whether a given chain is supported by the transactions proxy.
   *
   * @param {string} chain - The chain identifier (case-insensitive)
   * @returns {boolean} True if the chain is supported
   */
  isSupported(chain: string): boolean {
    if (!chain || typeof chain !== 'string') {
      return false;
    }
    return chain.toUpperCase() in providers;
  }

  /**
   * Retrieves the transaction provider for a given chain.
   *
   * @param {{ chain: string }} params - Object containing the chain identifier
   * @returns The transaction provider for the chain
   * @throws {Error} If the chain is not provided or not supported
   */
  get(params: { chain: string }) {
    if (!params || typeof params !== 'object') {
      throw new Error('Params must be an object with a "chain" property');
    }
    const chain = params.chain;
    if (!chain || typeof chain !== 'string') {
      throw new Error('Chain must be a non-empty string');
    }
    const normalizedChain = chain.toUpperCase();
    const provider = providers[normalizedChain];
    if (!provider) {
      throw new Error(`Unsupported chain: ${chain}. Supported chains: ${this.getSupportedChains().join(', ')}`);
    }
    return provider;
  }

  create(params: { chain: string; [key: string]: any }) {
    return this.get(params).create(params);
  }

  sign(params: { chain: string; [key: string]: any }): string {
    return this.get(params).sign(params);
  }

  getSignature(params: { chain: string; [key: string]: any }): string {
    return this.get(params).getSignature(params);
  }

  applySignature(params: { chain: string; [key: string]: any }) {
    return this.get(params).applySignature(params);
  }

  getHash(params: { chain: string; [key: string]: any }) {
    return this.get(params).getHash(params);
  }

  transformSignatureObject(params: { chain: string; [key: string]: any }) {
    return this.get(params).transformSignatureObject(params);
  }

  getSighash(params: { chain: string; [key: string]: any }): string {
    return this.get(params).getSighash(params);
  }
}

export default new TransactionsProxy();
