const BitcoreLib = require('bitcore-lib');
const BitcoreLibCash = require('bitcore-lib-cash');

interface IDeriver {
  deriveAddress(network: string, pubKey: string, addressIndex: number, isChange: boolean): string;
}

export abstract class AbstractBitcoreLibDeriver implements IDeriver {
  public abstract bitcoreLib;

  deriveAddress(network, pubKey, addressIndex, isChange) {
    const xpub = new this.bitcoreLib.HDPrivateKey(pubKey, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.bitcoreLib.Address(xpub.derive(path).publicKey, network).toString();
  }
}
export class BtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLib;
}

export class BchDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibCash;
}

const derivers: { [chain: string]: IDeriver } = {
  BTC: new BtcDeriver(),
  BCH: new BchDeriver()
};

export class AddressProviderProxy {
  get(chain) {
    return derivers[chain];
  }

  derive(chain, network, pubKey, addressIndex, isChange) {
    return this.get(chain).deriveAddress(network, pubKey, addressIndex, isChange);
  }
}

export const AddressProvider = new AddressProviderProxy();
