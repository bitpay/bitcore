const BitcoreLibLtc = require('bitcore-lib-ltc');
import { AbstractBitcoreLibDeriver } from '../btc';
export class LtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibLtc;

  deriveAddress(network, pubKey, addressIndex, isChange) {
    const xpub = new this.bitcoreLib.HDPublicKey(pubKey, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.bitcoreLib.Address(xpub.deriveChild(path).publicKey, network).toString();
  }
}
