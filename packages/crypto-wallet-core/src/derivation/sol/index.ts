import * as web3 from '@solana/web3.js';
import { IDeriver } from '..';

import { derivePath } from 'ed25519-hd-key';

const BitcoreLib = require('bitcore-lib');

export class SolDeriver implements IDeriver {
  deriveAddress(_network, _xpubkey, _addressIndex, _isChange) {
    if (true) {
      throw new Error('Cannot derive solona addresses from just xpubkey, need to use derivePrivateKeyWithPath');
    }
    return '';
  }

  deriveAddressWithPath(_network: string, _xpubKey: string, _path: string) {
    if (true) {
      throw new Error('Cannot derive solona addresses from just xpubkey, need to use derivePrivateKeyWithPath');
    }
    return '';
  }

  getAddress(network: string, pubKey) {
    pubKey = new BitcoreLib.PublicKey(pubKey, network);
    return this.addressFromPublicKeyBuffer(pubKey.toBuffer());
  }

  addressFromPublicKeyBuffer(pubKey: Buffer): string {
    return new web3.PublicKey(pubKey).toString();
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange) {
    const { privateKey } = xPriv;
    const changeNum = isChange ? 1 : 0;
    const path = `m/${addressIndex}'/${changeNum}'`;
    return this.derivePrivateKeyWithPath(network, privateKey || xPriv, path);
  }

  derivePrivateKeyWithPath(_network: string, seed: string, path: string) {
    const keypair = web3.Keypair.fromSeed(derivePath(path, seed).key); // TODO move derive path into mnemonic.js toSeed/fromSeed ?!
    const privKey = keypair.secretKey.toString();
    const pubKey = keypair.publicKey.toBase58();
    const address = pubKey;
    return { address, privKey, pubKey };
  }
}
