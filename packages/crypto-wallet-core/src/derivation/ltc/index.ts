const liteCore = require('litecore-lib');
const bitcoreLib = require('bitcore-lib');
import { AbstractBitcoreLibDeriver } from '../btc';
export class LtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = liteCore;

  deriveAddress(network, xpubStr, addressIndex, isChange) {
    const ltcNet = this.bitcoreLib.Networks.get(network);
    const xpub = new bitcoreLib.HDPublicKey(xpubStr, ltcNet);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const pubkeyStr = xpub.derive(path).publicKey.toString();
    const ltcPubkey = this.bitcoreLib.PublicKey.fromString(pubkeyStr);
    return this.bitcoreLib.Address(ltcPubkey, network).toString();
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange) {
    const ltcNet = this.bitcoreLib.Networks.get(network);
    const xpriv = new bitcoreLib.HDPrivateKey.fromString(xPriv, ltcNet);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const privKey = xpriv.derive(path).privateKey;
    const ltcPrivKey = this.bitcoreLib
      .PrivateKey(privKey.toString(), ltcNet)
      .toString();
    const pubkeyStr = privKey.publicKey.toString();
    const ltcPubkey = this.bitcoreLib.PublicKey.fromString(pubkeyStr);
    const address = this.bitcoreLib.Address(ltcPubkey, network).toString();
    return {
      address,
      privKey: ltcPrivKey.toString(),
      pubKey: pubkeyStr
    };
  }
}
