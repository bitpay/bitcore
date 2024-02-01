import { deriveAddress } from 'xrpl';
import { IDeriver } from '..';

import BitcoreLib from 'bitcore-lib';

export class XrpDeriver implements IDeriver {
  deriveAddress(network, xpubkey, addressIndex, isChange) {
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.deriveAddressWithPath(network, xpubkey, path);
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange) {
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.derivePrivateKeyWithPath(network, xPriv, path);
  }

  deriveAddressWithPath(network: string, xpubKey: string, path: string) {
    const xpub = new BitcoreLib.HDPublicKey(xpubKey, network);
    const pubKey = xpub.derive(path).toObject().publicKey;
    const address = deriveAddress(pubKey);
    return address;
  }

  derivePrivateKeyWithPath(network: string, xprivKey: string, path: string) {
    const xpriv = new BitcoreLib.HDPrivateKey(xprivKey, network);
    const derivedXPriv = xpriv.derive(path);
    const privKey = derivedXPriv.toObject().privateKey.toUpperCase();
    const pubKey = derivedXPriv.hdPublicKey.toObject().publicKey.toUpperCase();
    const address = deriveAddress(pubKey);
    return { address, privKey, pubKey };
  }

  getAddress(network: string, pubKey: string) {
    const address = deriveAddress(pubKey);
    return address;
  }
}
