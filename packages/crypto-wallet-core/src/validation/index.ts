import { ArbValidation } from './arb';
import { BaseValidation } from './base';
import { BchValidation } from './bch';
import { BtcValidation } from './btc';
import { DogeValidation } from './doge';
import { EthValidation } from './eth';
import { LtcValidation } from './ltc';
import { MaticValidation } from './matic';
import { OpValidation } from './op';
import { SolValidation } from './sol';
import { XrpValidation } from './xrp';
import type { IValidation } from '../types/validation';

const validation: { [chain: string]: IValidation } = {
  BTC: new BtcValidation(),
  BCH: new BchValidation(),
  ETH: new EthValidation(),
  XRP: new XrpValidation(),
  DOGE: new DogeValidation(),
  LTC: new LtcValidation(),
  MATIC: new MaticValidation(),
  ARB: new ArbValidation(),
  BASE: new BaseValidation(),
  OP: new OpValidation(),
  SOL: new SolValidation(),
};

export class ValidationProxy {
  /**
   * Returns the list of supported chain identifiers.
   *
   * @returns {string[]} Array of supported chain names (uppercase)
   */
  getSupportedChains(): string[] {
    return Object.keys(validation);
  }

  /**
   * Returns whether a given chain is supported by the validation proxy.
   *
   * @param {string} chain - The chain identifier (case-insensitive)
   * @returns {boolean} True if the chain is supported
   */
  isSupported(chain: string): boolean {
    if (!chain || typeof chain !== 'string') {
      return false;
    }
    return chain.toUpperCase() in validation;
  }

  /**
   * Retrieves the validation implementation for a given chain.
   *
   * @param {string} chain - The chain identifier (case-insensitive)
   * @returns {IValidation} The validation instance for the chain
   * @throws {Error} If the chain is not provided or not supported
   */
  get(chain: string): IValidation {
    if (!chain || typeof chain !== 'string') {
      throw new Error('Chain must be a non-empty string');
    }
    const normalizedChain = chain.toUpperCase();
    const validator = validation[normalizedChain];
    if (!validator) {
      throw new Error(`Unsupported chain: ${chain}. Supported chains: ${this.getSupportedChains().join(', ')}`);
    }
    return validator;
  }

  /**
   * Validates an address for the specified chain and network.
   *
   * @param {string} chain - The chain identifier (case-insensitive)
   * @param {string} network - The network (e.g. 'mainnet', 'testnet')
   * @param {string} address - The address to validate
   * @returns {boolean} True if the address is valid
   * @throws {Error} If chain is unsupported or address is not a string
   */
  validateAddress(chain: string, network: string, address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }
    return this.get(chain).validateAddress(network, address);
  }

  /**
   * Validates a URI for the specified chain.
   *
   * @param {string} chain - The chain identifier (case-insensitive)
   * @param {string} addressUri - The URI to validate
   * @returns {boolean} True if the URI is valid
   * @throws {Error} If chain is unsupported
   */
  validateUri(chain: string, addressUri: string): boolean {
    if (!addressUri || typeof addressUri !== 'string') {
      return false;
    }
    return this.get(chain).validateUri(addressUri);
  }
}

export default new ValidationProxy();
