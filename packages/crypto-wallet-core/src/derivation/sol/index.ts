import { HDPrivateKey, encoding } from '@bitpay-labs/bitcore-lib';
import * as ed25519 from 'ed25519-hd-key';
import { Paths } from '../paths';
import type { IDeriver, Key } from '../../types/derivation';

export class SolDeriver implements IDeriver {
  deriveAddress(_network, _xpubkey, _addressIndex, _isChange): string {
    throw new Error('Cannot derive Solana addresses from just xpubkey, need to use derivePrivateKeyWithPath');
  }

  deriveAddressWithPath(_network: string, _xpubKey: string, _path: string): string {
    throw new Error('Cannot derive Solana addresses from just xpubkey, need to use derivePrivateKeyWithPath');
  }

  getAddress(_network: string, pubKey: string) {
    return this.addressFromPublicKeyBuffer(Buffer.from(pubKey, 'hex'));
  }

  getPublicKey(_network: string, privKey: Buffer): string {
    if (!Buffer.isBuffer(privKey)) {
      throw new Error('Expected privKey to be a Buffer');
    }
    const pubKey = ed25519.getPublicKey(privKey, false);
    return Buffer.from(pubKey).toString('hex');
  }

  addressFromPublicKeyBuffer(pubKey: Buffer): string {
    if (pubKey.length > 32) {
      pubKey = pubKey.subarray(pubKey.length - 32);
    }
    return encoding.Base58.encode(pubKey);
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange, addressType) {
    const changeNum = isChange ? 1 : 0;
    const path = `${Paths['SOL'].default}${addressIndex}'/${changeNum}'`;
    return this.derivePrivateKeyWithPath(network, xPriv, path, addressType);
  };

  deriveChild(masterKey: { key: Buffer; chainCode: Buffer }, path: string) {
    const HARDENED_OFFSET = 0x80000000;
    const segmented = path
      .split('/')
      .slice(1)
      .map((val) => val.replace("'", ''))
      .map(el => parseInt(el, 10));
    return segmented.reduce((parentKeys, segment) => ed25519.CKDPriv(parentKeys, segment + HARDENED_OFFSET), masterKey);
  }

  derivePrivateKeyWithPath(network: string, xprivKey: string, path: string, _addressType: string) {
    const xpriv = new HDPrivateKey(xprivKey, network);
    const child = this.deriveChild({ key: xpriv._buffers.privateKey, chainCode: xpriv._buffers.chainCode }, path);
    const pubKey = ed25519.getPublicKey(child.key, false);
    const address = encoding.Base58.encode(pubKey);
    // Solana wallets often represent the private key as a KeyPair consisting of the private key + address/public key.
    // The Keypair is usually found in two formats: Base58 or Uint8Array.
    // Here, we represent the keys separately in Base58, which is fine since a keypair can be built or converted by createKeyPairFromPrivateKeyBytes.
    // Public Key is synonymous with Address. Here they are reprsented in two different formats. 
    return {
      address,
      privKey: encoding.Base58.encode(child.key),
      pubKey: Buffer.from(pubKey).toString('hex')
    } as Key;
  };

  /**
   * @param {Buffer | string} privKey - expects base 58 encoded string
   * @returns {Buffer}
   * @throws {Error} If privKey is not a Buffer (planned forwards compatibility) or string. Propagates all other errors
   */
  privateKeyToBuffer(privKey: Buffer | string): Buffer {
    if (Buffer.isBuffer(privKey)) return privKey;
    if (typeof privKey !== 'string') throw new Error(`Expected string, got ${typeof privKey}`);
    // Expects to match return from derivePrivateKey's privKey.
    return encoding.Base58.decode(privKey);
  }

  bufferToPrivateKey_TEMP(buf: Buffer, _network: string): string {
    return encoding.Base58.encode(buf);
  }
}