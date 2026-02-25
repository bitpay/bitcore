import BitcoreLib from '@bitpay-labs/bitcore-lib';
import { deriveAddress } from 'xrpl';
import type { IDeriver } from '../../types/derivation';

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
    return { address, privKey, pubKey, path };
  }

  getAddress(network: string, pubKey: string) {
    const address = deriveAddress(pubKey);
    return address;
  }

  getPublicKey(_network: string, privKey: Buffer): string {
    if (!Buffer.isBuffer(privKey)) {
      throw new Error('Expected privKey to be a Buffer');
    }
    // Match the pubKey representation returned from derivePrivateKeyWithPath (uppercase hex string)
    // Convert Buffer -> hex as the PrivateKey constructor input.
    // This avoids bitcore-lib rejecting the `{ bn }` object form in some builds.
    const key = new BitcoreLib.PrivateKey(privKey.toString('hex'));
    return key.publicKey.toString('hex').toUpperCase();
  }

  /**
   * @param {Buffer | string} privKey - expects hex-encoded string, as returned from XrpDeriver.derivePrivateKey privKey
   * @returns {Buffer}
   * @throws {Error} If privKey is not a Buffer (planned forwards compatibility) or string. Propagates all other errors
   */
  privateKeyToBuffer(privKey: Buffer | string): Buffer {
    if (Buffer.isBuffer(privKey)) return privKey;
    if (typeof privKey !== 'string') throw new Error(`Expected string, got ${typeof privKey}`);
    // Expects to match return from derivePrivateKey's privKey.
    return Buffer.from(privKey, 'hex');
  }

  bufferToPrivateKey_TEMP(buf: Buffer, _network: string): string {
    return buf.toString('hex').toUpperCase();
  }
}
