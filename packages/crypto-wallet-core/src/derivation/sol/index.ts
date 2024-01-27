import * as web3 from '@solana/web3.js';
import { IDeriver } from '..';

import { derivePath, getPublicKey } from 'ed25519-hd-key';
import * as nacl from 'tweetnacl';

const BitcoreLib = require('bitcore-lib');
const Base58 = BitcoreLib.encoding.Base58;

export class SolDeriver implements IDeriver {
  padTo32(msg) {
    while (msg.length < 32) {
      msg = Buffer.concat([new Buffer([0]), msg]);
    }
    if (msg.length !== 32) {
      throw new Error(`invalid key length: ${msg.length}`);
    }
    return msg;
  }

  deriveAddress(network, xpubkey, addressIndex, isChange) {
    const xpub = new BitcoreLib.HDPublicKey(xpubkey, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const derived = xpub.derive(path).publicKey;
    return this.deriveAddressWithPath(network, xpubkey, path);
  }

  addressFromPublicKeyBuffer(pubKey: Buffer): string {
    return Base58.fromBuffer(pubKey).toString();
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
