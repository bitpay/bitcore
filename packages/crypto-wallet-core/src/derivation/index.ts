import { BtcDeriver } from './btc';
import { BchDeriver } from './bch';
import { EthDeriver } from './eth';
import { Paths } from './paths';

export type Key = {
  address: string;
  privKey?: string;
  pubKey?: string;
};

export interface IDeriver {
  deriveAddress(
    network: string,
    xPub: string,
    addressIndex: number,
    isChange: boolean
  ): string;

  derivePrivateKey(
    network: string,
    xPriv: string,
    addressIndex: number,
    isChange: boolean
  ): Key;
}

const derivers: { [chain: string]: IDeriver } = {
  BTC: new BtcDeriver(),
  BCH: new BchDeriver(),
  ETH: new EthDeriver()
};

export class DerivationProxy {
  get(chain) {
    const normalizedChain = chain.toUpperCase();
    return derivers[normalizedChain];
  }

  deriveAddress(chain, network, pubKey, addressIndex, isChange) {
    return this.get(chain).deriveAddress(
      network,
      pubKey,
      addressIndex,
      isChange
    );
  }

  derivePrivateKey(chain, network, privKey, addressIndex, isChange) {
    return this.get(chain).derivePrivateKey(
      network,
      privKey,
      addressIndex,
      isChange
    );
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

export default new DerivationProxy();
