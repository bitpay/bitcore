import type { Encoding, HDKeyType, IMessageClass, ISignedMessage, KeyType } from '../types/message';
import { BtcMessage } from './btc';
import { EthMessage } from './eth';
import { SolMessage } from './sol';
import { XrpMessage } from './xrp';


const MessageClasses: Record<string, IMessageClass> = {
  btc: new BtcMessage(),
  bch: new BtcMessage(),
  doge: new BtcMessage(),
  ltc: new BtcMessage(),
  eth: new EthMessage(),
  matic: new EthMessage(),
  arb: new EthMessage(),
  base: new EthMessage(),
  op: new EthMessage(),
  sol: new SolMessage(),
  xrp: new XrpMessage()
};

export class MessageProxy {
  private get(chain: string): IMessageClass {
    const normalizedChain = chain.toLowerCase();
    const messageClass = MessageClasses[normalizedChain];
    if (!messageClass) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    return messageClass;
  }

  getMessageHash(args: {
    chain: string,
    message: string,
    /** The encoding to use for the output. Will return a Buffer if not specified. */
    encoding?: Encoding
  }): Buffer | string {
    const { message, chain, encoding } = args;
    const messageClass = this.get(chain);
    return messageClass.getMessageHash({ message, encoding });
  }

  signMessage(args: {
    chain: string,
    message: string,
    privateKey: KeyType,
    /** The encoding to use for the output. Will return a Buffer if not specified. */
    encoding?: Encoding
  }): ISignedMessage {
    const { message, chain, privateKey, encoding } = args;
    const messageClass = this.get(chain);
    if (!messageClass) throw new Error(`Unsupported chain: ${chain}`);
    return messageClass.signMessage({ message, privateKey, encoding });
  }

  signMessageWithPath(args: {
    chain: string,
    message: string,
    hdPrivateKey: HDKeyType,
    derivationPath: string,
    /** The encoding to use for the output. Will return a Buffer if not specified. */
    encoding?: Encoding
  }): ISignedMessage {
    const { message, chain, hdPrivateKey, derivationPath, encoding } = args;
    const messageClass = this.get(chain);
    return messageClass.signMessageWithPath({ message, hdPrivateKey, derivationPath, encoding });
  }
}

export default new MessageProxy();