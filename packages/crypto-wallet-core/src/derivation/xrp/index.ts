import rippleKeypairs from 'ripple-keypairs';
import { IDeriver } from '..';

import BitcoreLib from 'bitcore-lib';

export class XrpDeriver implements IDeriver {
  deriveAddress(network, xpubkey, addressIndex, isChange) {
    const xpub = new BitcoreLib.HDPublicKey(xpubkey, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const pubKey = xpub.derive(path).toObject().publicKey;
    const address = rippleKeypairs.deriveAddress(pubKey);
    return address;
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange) {
    const xpriv = new BitcoreLib.HDPrivateKey(xPriv, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const derivedXPriv = xpriv.derive(path);
    const privKey = derivedXPriv.toObject().privateKey.toUpperCase();
    const pubKey = derivedXPriv.hdPublicKey.toObject().publicKey.toUpperCase();
    const address = rippleKeypairs.deriveAddress(pubKey);
    return { address, privKey, pubKey };
  }
}
