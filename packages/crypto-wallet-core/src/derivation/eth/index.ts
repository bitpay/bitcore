import { ec } from 'elliptic';
import { pubToAddress } from 'ethereumjs-util';
import { IDeriver } from '..';

const BitcoreLib = require('bitcore-lib');
const secp = new ec('secp256k1');

export class EthDeriver implements IDeriver {
  padTo32(msg) {
    while (msg.length < 32) {
      msg = Buffer.concat([new Buffer([0]), msg]);
    }
    if (msg.length !== 32) {
      throw new Error(`invalid key length: ${msg.length}`);
    }
    return msg;
  }

  deriveAddress(network, pubKey, addressIndex, isChange) {
    const xpub = new BitcoreLib.HDPublicKey(pubKey, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const derived = xpub.derive(path).publicKey;
    return this.addressFromPublicKeyBuffer(derived.toBuffer());
  }

  addressFromPublicKeyBuffer(pubKey: Buffer): string {
    const ecKey = secp.keyFromPublic(pubKey);
    const ecPub = ecKey.getPublic().toJSON();
    const paddedBuffer = Buffer.concat([
      this.padTo32(new Buffer(ecPub[0].toArray())),
      this.padTo32(new Buffer(ecPub[1].toArray()))
    ]);
    return `0x${pubToAddress(paddedBuffer).toString('hex')}`;
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange) {
    const xpriv = new BitcoreLib.HDPrivateKey(xPriv, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const derivedPrivKey = xpriv.derive(path);
    const privKey = derivedPrivKey.privateKey.toString('hex');
    const pubKeyObj = derivedPrivKey.publicKey;
    const pubKey = pubKeyObj.toString('hex');
    const pubKeyBuffer = pubKeyObj.toBuffer();
    const address = this.addressFromPublicKeyBuffer(pubKeyBuffer);
    return { address, privKey, pubKey };
  }
}
