import { ArbDeriver } from './arb';
import { BaseDeriver } from './base';
import { BchDeriver } from './bch';
import { BtcDeriver } from './btc';
import { DogeDeriver } from './doge';
import { EthDeriver } from './eth';
import { LtcDeriver } from './ltc';
import { MaticDeriver } from './matic';
import { OpDeriver } from './op';
import { Paths } from './paths';
import { SolDeriver } from './sol';
import { XrpDeriver } from './xrp';
import type { IDeriver } from '../types/derivation';

const derivers: { [chain: string]: IDeriver } = {
  BTC: new BtcDeriver(),
  BCH: new BchDeriver(),
  ETH: new EthDeriver(),
  XRP: new XrpDeriver(),
  DOGE: new DogeDeriver(),
  LTC: new LtcDeriver(),
  MATIC: new MaticDeriver(),
  ARB: new ArbDeriver(),
  BASE: new BaseDeriver(),
  OP: new OpDeriver(),
  SOL: new SolDeriver()
};

export class DeriverProxy {
  /**
   * Returns the list of supported chain identifiers.
   *
   * @returns {string[]} Array of supported chain names (uppercase)
   */
  getSupportedChains(): string[] {
    return Object.keys(derivers);
  }

  /**
   * Returns whether a given chain is supported by the deriver proxy.
   *
   * @param {string} chain - The chain identifier (case-insensitive)
   * @returns {boolean} True if the chain is supported
   */
  isSupported(chain: string): boolean {
    if (!chain || typeof chain !== 'string') {
      return false;
    }
    return chain.toUpperCase() in derivers;
  }

  /**
   * Retrieves the deriver implementation for a given chain.
   *
   * @param {string} chain - The chain identifier (case-insensitive)
   * @returns {IDeriver} The deriver instance for the chain
   * @throws {Error} If the chain is not provided or not supported
   */
  private get(chain: string): IDeriver {
    if (!chain || typeof chain !== 'string') {
      throw new Error('Chain must be a non-empty string');
    }
    const normalizedChain = chain.toUpperCase();
    const deriver = derivers[normalizedChain];
    if (!deriver) {
      throw new Error(`Unsupported chain: ${chain}. Supported chains: ${this.getSupportedChains().join(', ')}`);
    }
    return deriver;
  }

  /**
   * This derives addresses using the conventional paths.
   * @param {string} chain - The chain identifier
   * @param {string} network - The network name
   * @param {string} xpubKey - The extended public key
   * @param {number} addressIndex - The address index
   * @param {boolean} isChange - Whether this is a change address
   * @param {string} [addressType] - Optional address type
   * @returns The derived address
   */
  deriveAddress(chain: string, network: string, xpubKey: string, addressIndex: number, isChange: boolean, addressType?: string) {
    return this.get(chain).deriveAddress(network, xpubKey, addressIndex, isChange, addressType);
  }

  /**
   * This derives keys/addresses using the conventional paths.
   * @param {string} chain - The chain identifier
   * @param {string} network - The network name
   * @param {string} privKey - The private key
   * @param {number} addressIndex - The address index
   * @param {boolean} isChange - Whether this is a change address
   * @param {string} [addressType] - Optional address type
   * @returns The derived private key info
   */
  derivePrivateKey(chain: string, network: string, privKey: string, addressIndex: number, isChange: boolean, addressType?: string) {
    return this.get(chain).derivePrivateKey(network, privKey, addressIndex, isChange, addressType);
  }

  /**
   * This derives addresses on a specific path.
   * This should probably only be used when importing from another wallet
   *   where known paths are provided with their keys. Most of the BitPay
   *   codebase uses `deriveAddress()`
   * @param {string} chain - The chain identifier
   * @param {string} network - The network name
   * @param {string} xpubKey - The extended public key
   * @param {string} path - The derivation path
   * @param {string} addressType - The address type
   * @returns The derived address
   */
  deriveAddressWithPath(chain: string, network: string, xpubKey: string, path: string, addressType: string) {
    return this.get(chain).deriveAddressWithPath(network, xpubKey, path, addressType);
  }

  /**
   * This derives keys/addresses on a specific path.
   * This should probably only be used when importing from another wallet
   *   where known paths are provided with their keys. Most of the BitPay
   *   codebase uses `derivePrivateKey()`
   * @param {string} chain - The chain identifier
   * @param {string} network - The network name
   * @param {string} xprivKey - The extended private key
   * @param {string} path - The derivation path
   * @param {string} addressType - The address type
   * @returns The derived private key info
   */
  derivePrivateKeyWithPath(chain: string, network: string, xprivKey: string, path: string, addressType: string) {
    return this.get(chain).derivePrivateKeyWithPath(network, xprivKey, path, addressType);
  }

  /**
   * This is a simple function for getting an address from a
   * given pub key and chain. There is no derivation happening.
   * @param {string} chain - The chain identifier
   * @param {string} network - The network name
   * @param {string} pubKey - The public key
   * @param {string} [addressType] - Optional address type
   * @returns The address
   */
  getAddress(chain: string, network: string, pubKey: string, addressType?: string) {
    return this.get(chain).getAddress(network, pubKey, addressType);
  }

  /**
   * Returns the BIP44 derivation path for a given chain and network.
   *
   * @param {string} chain - The chain identifier
   * @param {string} network - The network name
   * @param {number} [account=0] - The account index
   * @returns {string} The derivation path
   */
  pathFor(chain: string, network: string, account: number = 0): string {
    if (!chain || typeof chain !== 'string') {
      throw new Error('Chain must be a non-empty string');
    }
    const normalizedChain = chain.toUpperCase();
    const accountStr = `${account}'`;
    const chainConfig = Paths[normalizedChain];
    if (chainConfig) {
      if (chainConfig[network]) {
        return chainConfig[network] + accountStr;
      } else {
        return chainConfig.default + accountStr;
      }
    } else {
      return Paths.BTC.default + accountStr;
    }
  }
}

export default new DeriverProxy();
