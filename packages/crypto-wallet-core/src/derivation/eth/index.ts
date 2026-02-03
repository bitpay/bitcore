import BitcoreLib from 'bitcore-lib';
import Web3 from 'web3';
import type { IDeriver } from '../../types/derivation';

export class EthDeriver implements IDeriver {
  padTo32(msg) {
    while (msg.length < 32) {
      msg = Buffer.concat([Buffer.from([0]), msg]);
    }
    if (msg.length !== 32) {
      throw new Error(`invalid key length: ${msg.length}`);
    }
    return msg;
  }

  deriveAddress(network, xpubkey, addressIndex, isChange) {
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.deriveAddressWithPath(network, xpubkey, path);
  }

  addressFromPublicKeyBuffer(pubKey: Buffer): string {
    const ecPoint = new BitcoreLib.PublicKey.fromBuffer(pubKey).point;
    const x = ecPoint.getX().toBuffer({ size: 32 });
    const y = ecPoint.getY().toBuffer({ size: 32 });
    const paddedBuffer = Buffer.concat([x, y]);
    const address = Web3.utils.keccak256(`0x${paddedBuffer.toString('hex')}`).slice(26);
    return Web3.utils.toChecksumAddress(address);
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange) {
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.derivePrivateKeyWithPath(network, xPriv, path);
  }

  deriveAddressWithPath(network: string, xpubKey: string, path: string) {
    const xpub = new BitcoreLib.HDPublicKey(xpubKey, network);
    const derived = xpub.derive(path).publicKey;
    return this.addressFromPublicKeyBuffer(derived.toBuffer());
  }

  derivePrivateKeyWithPath(network: string, xprivKey: string, path: string) {
    const xpriv = new BitcoreLib.HDPrivateKey(xprivKey, network);
    const derivedPrivKey = xpriv.derive(path);
    const privKey = derivedPrivKey.privateKey.toString('hex');
    const pubKeyObj = derivedPrivKey.publicKey;
    const pubKey = pubKeyObj.toString('hex');
    const pubKeyBuffer = pubKeyObj.toBuffer();
    const address = this.addressFromPublicKeyBuffer(pubKeyBuffer);
    return { address, privKey, pubKey, path };
  }

  getAddress(network: string, pubKey) {
    pubKey = new BitcoreLib.PublicKey(pubKey, network); // network not needed here since ETH doesn't differentiate addresses by network.
    return this.addressFromPublicKeyBuffer(pubKey.toBuffer());
  }

  getPublicKey(_network: string, privKey: Buffer): string {
    if (!Buffer.isBuffer(privKey)) {
      throw new Error('Expected privKey to be a Buffer');
    }
    // Match the pubKey representation returned from derivePrivateKeyWithPath (hex string)
    // Convert Buffer -> hex as the PrivateKey constructor input.
    // This avoids bitcore-lib rejecting the `{ bn }` object form in some builds.
    const key = new BitcoreLib.PrivateKey(privKey.toString('hex'));
    return key.publicKey.toString('hex');
  }

  /**
   * @param {Buffer | string} privKey - expects hex-encoded string, as returned from EthDeriver.derivePrivateKey
   * @returns {Buffer}
   * @throws {Error} If privKey is not a Buffer (planned forwards compatibility) or string. Propagates all other errors
   */
  privateKeyToBuffer(privKey: Buffer | string): Buffer {
    if (Buffer.isBuffer(privKey)) return privKey;
    if (typeof privKey !== 'string') throw new Error(`Expected string, got ${typeof privKey}`);
    if (privKey.startsWith('0x')) {
      privKey = privKey.slice(2);
    };
    // Expects to match return from derivePrivateKey's privKey.
    return Buffer.from(privKey, 'hex');
  }

  privateKeyBufferToNativePrivateKey(buf: Buffer, _network: string): any {
    return buf.toString('hex');
  }
}
