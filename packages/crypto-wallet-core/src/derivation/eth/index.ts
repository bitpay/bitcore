import { IDeriver } from '..';

import utils from 'web3-utils';

const BitcoreLib = require('bitcore-lib');

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
    const ecPoint = new BitcoreLib.PublicKey.fromBuffer(pubKey).point;
    const x = ecPoint.getX().toBuffer({ size: 32 });
    const y = ecPoint.getY().toBuffer({ size: 32 });
    const paddedBuffer = Buffer.concat([x, y]);
    const address = utils.keccak256(`0x${paddedBuffer.toString('hex')}`).slice(26);
    return utils.toChecksumAddress(address);
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
