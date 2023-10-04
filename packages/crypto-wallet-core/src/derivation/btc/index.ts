const BitcoreLib = require('bitcore-lib');
import { IDeriver } from '..';

export abstract class AbstractBitcoreLibDeriver implements IDeriver {
  public abstract bitcoreLib;

  deriveAddress(network, pubKey, addressIndex, isChange, addressType) {
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.deriveAddressWithPath(network, pubKey, path, addressType);
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange, addressType) {
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.derivePrivateKeyWithPath(network, xPriv, path, addressType);
  }

  deriveAddressWithPath(network: string, xpubKey: string, path: string, addressType: string) {
    const xpub = new this.bitcoreLib.HDPublicKey(xpubKey, network);
    return this.getAddress(network, xpub.derive(path).publicKey, addressType);
  }

  derivePrivateKeyWithPath(network: string, xprivKey: string, path: string, addressType: string) {
    const xpriv = new this.bitcoreLib.HDPrivateKey(xprivKey, network);
    const privKey = xpriv.deriveChild(path).privateKey;
    const pubKey = privKey.publicKey;
    const address = this.getAddress(network, pubKey, addressType);
    return { address, privKey: privKey.toString(), pubKey: pubKey.toString() };
  }

  getAddress(network: string, pubKey, addressType: string) {
    pubKey = new this.bitcoreLib.PublicKey(pubKey);
    return new this.bitcoreLib.Address(pubKey, network, addressType).toString();
  }
}
export class BtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLib;
}
