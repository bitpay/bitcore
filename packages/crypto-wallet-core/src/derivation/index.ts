import { BtcDeriver } from './btc';
import { BchDeriver } from './bch';
import { EthDeriver } from './eth';
import { Paths } from "./paths";

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
    return derivers[chain];
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

  pathFor(chain, network) {
    if (network != 'mainnet') {
      return Paths.default.testnet;
    } else {
      return Paths[chain][network];
    }
  }
}

export const Deriver = new DerivationProxy();
