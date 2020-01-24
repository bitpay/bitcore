import { Libs } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '..';
import { BtcChain } from '../btc';

export class LtcChain extends BtcChain implements IChain {
  constructor() {
    super();
  }

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub) {
    if (signatures.length != inputs.length)
      throw new Error('Number of signatures does not match number of inputs');

    let i = 0;
    const x = new Libs.BTC.HDPublicKey(xpub);

    _.each(signatures, signatureHex => {
      try {
        const signature = Libs.LTC.crypto.Signature.fromString(
          signatureHex
        );
        const pub = x.deriveChild(inputPaths[i]).publicKey;
        const s = {
          inputIndex: i,
          signature,
          sigtype:
            // tslint:disable-next-line:no-bitwise
            Libs.LTC.crypto.Signature.SIGHASH_ALL |
            Libs.LTC.crypto.Signature.SIGHASH_FORKID,
          publicKey: pub
        };
        tx.inputs[i].addSignature(tx, s);
        i++;
      } catch (e) {}
    });

    if (i != tx.inputs.length) throw new Error('Wrong signatures');
  }
}
