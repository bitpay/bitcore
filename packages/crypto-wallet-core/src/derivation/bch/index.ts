import { AbstractBitcoreLibDeriver } from '../btc';
import BitcoreLibCash from 'bitcore-lib-cash';
export class BchDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibCash;

  getAddress(network: string, pubKey, addressType: string) {
    pubKey = new this.bitcoreLib.PublicKey(pubKey);
    return new this.bitcoreLib.Address(pubKey, network, addressType).toString(true);
  }
}
