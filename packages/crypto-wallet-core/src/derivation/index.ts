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
  private get(chain) {
    const normalizedChain = chain.toUpperCase();
    return derivers[normalizedChain];
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
  getAddress(chain, network, pubKey, addressType?) {
    return this.get(chain).getAddress(network, pubKey, addressType);
  }

  getPublicKey(chain, network, privKey) {
    return this.get(chain).getPublicKey(network, privKey);
  }

  pathFor(chain, network, account = 0) {
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

  privateKeyToBuffer(chain, privateKey: Buffer | string): Buffer {
    return this.get(chain).privateKeyToBuffer(privateKey);
  }

  privateKeyBufferToNativePrivateKey(chain: string, network: string, buf: Buffer): any {
    return this.get(chain).privateKeyBufferToNativePrivateKey(buf, network);
  }
}

export default new DeriverProxy();
