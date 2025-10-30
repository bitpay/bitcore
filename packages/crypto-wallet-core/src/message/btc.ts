import BitcoreLib from 'bitcore-lib';
import { encodeBuffer } from '../utils';
import type { Encoding, HDKeyType, IMessageClass, ISignedMessage, KeyType } from '../types/message';

export class BtcMessage implements IMessageClass {
  getMessageHash(args: { message: string, encoding?: Encoding }): Buffer | string {
    const { message, encoding } = args;
    const buf = Buffer.from(new BitcoreLib.Message(message).magicHash());
    return encodeBuffer(buf, encoding);
  }

  signMessage(args: { message: string, privateKey: KeyType, encoding?: Encoding }): ISignedMessage {
    const { message, encoding } = args;
    let { privateKey } = args;
    privateKey = new BitcoreLib.PrivateKey(privateKey);
    const buf = Buffer.from(new BitcoreLib.Message(message).sign(privateKey), 'base64');
    return {
      signature: encodeBuffer(buf, encoding),
      publicKey: privateKey.publicKey.toString()
    };
  }

  signMessageWithPath(args: { message: string, hdPrivateKey: HDKeyType, derivationPath: string, encoding?: Encoding }): ISignedMessage {
    const { message, hdPrivateKey, derivationPath, encoding } = args;
    const privateKey = new BitcoreLib.HDPrivateKey(hdPrivateKey).deriveChild(derivationPath).privateKey;
    return this.signMessage({ message, privateKey, encoding });
  }
}
