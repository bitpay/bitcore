import type BitcoreLib from '@bitpay-labs/bitcore-lib';

export type KeyType = string | BitcoreLib.PrivateKey;
export type HDKeyType = string | BitcoreLib.HDPrivateKey;
export type Encoding = BufferEncoding | 'base58';
export interface ISignedMessage<T = Buffer | string> {
  signature: T;
  publicKey: string;
}

export interface IMessageClass {
  getMessageHash(args: { message: string; encoding?: Encoding }): Buffer | string;
  signMessage(args: { message: string; privateKey: KeyType; encoding?: Encoding }): ISignedMessage;
  signMessageWithPath(args: { message: string; hdPrivateKey: HDKeyType; derivationPath: string; encoding?: Encoding }): ISignedMessage;
}