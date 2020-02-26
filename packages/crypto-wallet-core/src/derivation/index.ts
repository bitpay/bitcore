import { BchDeriver } from './bch';
import { BtcDeriver } from './btc';
import { EthDeriver } from './eth';
import { Paths } from './paths';
import { XrpDeriver } from './xrp';

export interface Key {
  address: string;
  privKey?: string;
  pubKey?: string;
}

export interface IDeriver {
  deriveAddress(
    network: string,
    xPub: string,
    addressIndex: number,
    options: { isChange?: boolean; isBech32?: boolean }
  ): string;

  derivePrivateKey(
    network: string,
    xPriv: string,
    addressIndex: number,
    options: { isChange?: boolean; isBech32?: boolean }
  ): Key;
}

const derivers: { [chain: string]: IDeriver } = {
  BTC: new BtcDeriver(),
  BCH: new BchDeriver(),
  ETH: new EthDeriver(),
  XRP: new XrpDeriver()
};

export class DeriverProxy {
  get(chain) {
    return derivers[chain];
  }

  deriveAddress(chain, network, xpubKey, addressIndex, options = {}) {
    return this.get(chain).deriveAddress(network, xpubKey, addressIndex, options);
  }

  derivePrivateKey(chain, network, privKey, addressIndex, options = {}) {
    return this.get(chain).derivePrivateKey(network, privKey, addressIndex, options);
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
