import { Wallet } from '../../wallet';
import { BtcDeriver } from './btc';
import { BchDeriver } from './bch';
import { EthDeriver } from './eth';

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
  ): Wallet.KeyImport;
}

const derivers: { [chain: string]: IDeriver } = {
  BTC: new BtcDeriver(),
  BCH: new BchDeriver(),
  ETH: new EthDeriver()
};

const paths = {
  BTC: {
    mainnet: `m/44'/0'/0'`
  },
  BCH: {
    mainnet: `m/44'/145'/0'`
  },
  ETH: {
    mainnet: `m/44'/60'/0'`
  },
  default: {
    testnet: `m/44'/1'/0'`
  }
};

export class AddressProviderProxy {
  get(chain) {
    return derivers[chain];
  }

  derive(chain, network, pubKey, addressIndex, isChange) {
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
      return paths.default.testnet;
    } else {
      return paths[chain][network];
    }
  }
}

export const AddressProvider = new AddressProviderProxy();
