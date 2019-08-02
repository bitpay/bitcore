import { ec } from 'elliptic';
import { pubToAddress, toChecksumAddress } from 'ethereumjs-util';
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

  deriveAddress(network, xpubkey, addressIndex, isChange) {
    const xpub = new BitcoreLib.HDPublicKey(xpubkey, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const derived = xpub.derive(path).publicKey;
    return this.addressFromPublicKeyBuffer(derived.toBuffer());
  }

  addressFromPublicKeyBuffer(pubKey: Buffer): string {
    const ecKey = secp.keyFromPublic(pubKey);
    const x = ecKey
      .getPublic()
      .getX()
      .toBuffer();
    const y = ecKey
      .getPublic()
      .getY()
      .toBuffer();
    const paddedBuffer = Buffer.concat([this.padTo32(x), this.padTo32(y)]);
    const address = `0x${pubToAddress(paddedBuffer).toString('hex')}`;
    return toChecksumAddress(address);
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
