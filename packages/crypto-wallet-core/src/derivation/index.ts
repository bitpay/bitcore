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

  deriveAddress(chain, network, xpubKey, addressIndex, isChange, addressType?) {
    return this.get(chain).deriveAddress(network, xpubKey, addressIndex, isChange, addressType);
  }

  derivePrivateKey(chain, network, privKey, addressIndex, isChange, addressType?) {
    return this.get(chain).derivePrivateKey(network, privKey, addressIndex, isChange, addressType);
  }

  deriveAddressWithPath(chain, network, xpubKey, path, addressType) {
    return this.get(chain).deriveAddressWithPath(network, xpubKey, path, addressType);
  }

  derivePrivateKeyWithPath(chain, network, xprivKey, path, addressType) {
    return this.get(chain).derivePrivateKeyWithPath(network, xprivKey, path, addressType);
  }

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
