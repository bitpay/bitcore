import BitcoreLib from 'bitcore-lib';
import type { IDeriver } from '../../types/derivation';

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
    return { address, privKey: privKey.toString(), pubKey: pubKey.toString(), path };
  }

  getAddress(network: string, pubKey, addressType: string) {
    pubKey = new this.bitcoreLib.PublicKey(pubKey);
    return new this.bitcoreLib.Address(pubKey, network, addressType).toString();
  }

  /**
   * @returns {Buffer} raw secpk1 private key buffer (32 bytes, big-endian)
   * @throws {Error} If privKey is not a Buffer (planned forwards compatibility) or string. Propagates all other errors
   */
  privateKeyToBuffer(privKey: any): Buffer {
    if (Buffer.isBuffer(privKey)) return privKey; // forward compatibility
    if (typeof privKey !== 'string') throw new Error(`Expected key to be a string, got ${typeof privKey}`);

    const key = new this.bitcoreLib.PrivateKey(privKey);
    return key.toBuffer();
  }

  privateKeyBufferToNativePrivateKey(buf: Buffer, network: string): any {
    // force compressed WIF without mutating instances
    const bn = this.bitcoreLib.crypto.BN.fromBuffer(buf);
    const key = new this.bitcoreLib.PrivateKey({ bn, network, compressed: true });
    return key.toWIF();
  }
}
export class BtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLib;
}
