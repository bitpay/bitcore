import * as web3 from '@solana/web3.js';
import { IDeriver } from '..';

import { derivePath, getPublicKey } from 'ed25519-hd-key';

const BitcoreLib = require('bitcore-lib');
const Base58 = BitcoreLib.encoding.Base58;

export class SolDeriver implements IDeriver {
  deriveAddress(network, xpubkey, addressIndex, isChange) {
    throw new Error('Cannot derive solona addresses from just xpubkey, need to use derivePrivateKeyWithPath');
  }

  addressFromPublicKeyBuffer(pubKey: Buffer): string {
    return Base58.fromBuffer(pubKey).toString();
  }

  deriveAddressWithPath(network: string, xpubKey: string, path: string) {
    throw new Error('Cannot derive solona addresses from just xpubkey, need to use derivePrivateKeyWithPath');
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange) {
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}'/${addressIndex}'`;
    return this.derivePrivateKeyWithPath(network, xPriv, path);
  }

  derivePrivateKeyWithPath(network: string, seed: string, path: string) {
    const keypair = web3.Keypair.fromSeed(derivePath(path, seed).key);
    const privKey = keypair.secretKey.toString();
    const pubKey = keypair.publicKey.toBase58();
    const address = pubKey;
    return { address, privKey, pubKey };
  }

  getAddress(network: string, pubKey) {
    pubKey = new BitcoreLib.PublicKey(pubKey, network); // network not needed here since ETH doesn't differentiate addresses by network.
    return this.addressFromPublicKeyBuffer(pubKey.toBuffer());
  }
}
