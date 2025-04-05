const BitcoreLibCash = require('bitcore-lib-cash');
import { AbstractBitcoreLibDeriver } from '../btc';
export class BchDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibCash;

  getAddress(network: string, pubKey, addressType: string) {
    pubKey = new this.bitcoreLib.PublicKey(pubKey);
    return new this.bitcoreLib.Address(pubKey, network, addressType).toString(true);
  }
}
