import { BchDeriver } from './bch';
import { BtcDeriver } from './btc';
import { DogeDeriver } from './doge';
import { EthDeriver } from './eth';
import { LtcDeriver } from './ltc';
import { MaticDeriver } from './matic';
import { Paths } from './paths';
import { XrpDeriver } from './xrp';

export interface Key {
  address: string;
  privKey?: string;
  pubKey?: string;
}

export interface IDeriver {
  deriveAddress(network: string, xPub: string, addressIndex: number, isChange: boolean, addressType?: string): string;

  derivePrivateKey(network: string, xPriv: string, addressIndex: number, isChange: boolean, addressType?: string): Key;

  deriveAddressWithPath(network: string, xpubKey: string, path: string, addressType: string): string;

  derivePrivateKeyWithPath(network, xprivKey: string, path: string, addressType: string): Key;

  getAddress(network: string, pubKey, addressType: string): string;
}

const derivers: { [chain: string]: IDeriver } = {
  BTC: new BtcDeriver(),
  BCH: new BchDeriver(),
  ETH: new EthDeriver(),
  XRP: new XrpDeriver(),
  DOGE: new DogeDeriver(),
  LTC: new LtcDeriver(),
  MATIC: new MaticDeriver()
};

export class DeriverProxy {
  get(chain) {
    return derivers[chain];
  }

  /**
   * This is derives addresses using the conventional paths.
   * @param chain
   * @param network
   * @param xpubKey
   * @param addressIndex
   * @param isChange
   * @param addressType
   * @returns
   */
  deriveAddress(chain, network, xpubKey, addressIndex, isChange, addressType?) {
    return this.get(chain).deriveAddress(network, xpubKey, addressIndex, isChange, addressType);
  }

  /**
   * This derives keys/addresses using the conventional paths.
   * @param chain
   * @param network
   * @param privKey
   * @param addressIndex
   * @param isChange
   * @param addressType
   * @returns
   */
  derivePrivateKey(chain, network, privKey, addressIndex, isChange, addressType?) {
    return this.get(chain).derivePrivateKey(network, privKey, addressIndex, isChange, addressType);
  }

  /**
   * This derives addresses on a specific path.
   * This should probably only be used when importing from another wallet
   *   where known paths are provided with their keys. Most of the BitPay
   *   codebase uses `deriveAddress()`
   * @param chain
   * @param network
   * @param xpubKey
   * @param path
   * @param addressType
   * @returns
   */
  deriveAddressWithPath(chain, network, xpubKey, path, addressType) {
    return this.get(chain).deriveAddressWithPath(network, xpubKey, path, addressType);
  }

  /**
   * This derives keys/addresses on a specific path.
   * This should probably only be used when importing from another wallet
   *   where known paths are provided with their keys. Most of the BitPay
   *   codebase uses `derivePrivateKey()`
   * @param chain
   * @param network
   * @param xprivKey
   * @param path
   * @param addressType
   * @returns
   */
  derivePrivateKeyWithPath(chain, network, xprivKey, path, addressType) {
    return this.get(chain).derivePrivateKeyWithPath(network, xprivKey, path, addressType);
  }

  /**
   * This is a simple function for getting an address from a
   * given pub key and chain. There is no derivation happening.
   * @param chain
   * @param network
   * @param pubKey
   * @param addressType
   * @returns
   */
  getAddress(chain, network, pubKey, addressType) {
    return this.get(chain).getAddress(network, pubKey, addressType);
  }

  pathFor(chain, network, account = 0) {
    const normalizedChain = chain.toUpperCase();
    const accountStr = `${account}'`;
    const chainConfig = Paths[normalizedChain];
    if (chainConfig && chainConfig[network]) {
      return chainConfig[network] + accountStr;
    } else {
      return Paths.default.testnet + accountStr;
    }
  }
}

export default new DeriverProxy();
