import type { Encoding, HDKeyType, IMessageClass, ISignedMessage, KeyType } from '../types/message';
import BitcoreLib from 'bitcore-lib';
import { encodeBuffer } from '../utils';
import { ethers } from 'ethers';

export class EthMessage implements IMessageClass {
  getMessageHash(args: {
    message: string,
    encoding?: Encoding
  }): Buffer | string {
    const { message, encoding } = args;
    const prefix = '\x19Ethereum Signed Message:\n' + message.length;
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(prefix + message));
    const buf = Buffer.from(messageHash.slice(2), 'hex');
    return encodeBuffer(buf, encoding);
  }

  signMessage(args: {
    message: string,
    privateKey: KeyType,
    encoding?: Encoding
  }): ISignedMessage {
    const { message, encoding } = args;
    let { privateKey } = args;
    privateKey = typeof privateKey === 'string' && privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    privateKey = new BitcoreLib.PrivateKey(privateKey);
    const messageHash = this.getMessageHash({ message });
    const signingKey = new ethers.SigningKey('0x' + privateKey.toString('hex'));
    const sig = signingKey.sign(messageHash);
    const buf = Buffer.from(sig.serialized.slice(2), 'hex');
    return {
      signature: encodeBuffer(buf, encoding),
      publicKey: privateKey.publicKey.toString()
    };
  }

  signMessageWithPath(args: {
    message: string,
    hdPrivateKey: HDKeyType,
    derivationPath: string,
    encoding?: Encoding
  }): ISignedMessage {
    const { message, hdPrivateKey, derivationPath, encoding } = args;
    const privateKey = new BitcoreLib.HDPrivateKey(hdPrivateKey).deriveChild(derivationPath).privateKey;
    return this.signMessage({ message, privateKey, encoding });
  }
}