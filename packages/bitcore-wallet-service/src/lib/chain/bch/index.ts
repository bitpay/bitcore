import { BitcoreLib, BitcoreLibCash } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '..';
import { BtcChain } from '../btc';

const Errors = require('../../errors/errordefinitions');

export class BchChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibCash);
    this.feeSafetyMargin = 0.1;
  }

  validateAddress(wallet, inaddr, opts) {
    const A = BitcoreLibCash.Address;
    let addr: {
      network?: string;
      toString?: (cashAddr: boolean) => string;
    } = {};
    try {
      addr = new A(inaddr);
    } catch (ex) {
      throw Errors.INVALID_ADDRESS;
    }
    if (addr.network.toString() != wallet.network) {
      throw Errors.INCORRECT_ADDRESS_NETWORK;
    }
    if (!opts.noCashAddr) {
      if (addr.toString(true) != inaddr) throw Errors.ONLY_CASHADDR;
    }
    return;
  }

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub, signingMethod) {
    signingMethod = signingMethod || 'ecdsa';
    if (signatures.length != inputs.length) throw new Error('Number of signatures does not match number of inputs');

    let i = 0;
    const x = new BitcoreLibCash.HDPublicKey(xpub);
    _.each(signatures, signatureHex => {
console.log('##[index.ts.780:signatureHex:]',signatureHex.length); // TODO

      // fix padding issues
      if (signingMethod == 'schnorr' && signatureHex.length != 128) {
        signatureHex= _.padStart(signatureHex,128,'0');
      }



      try {
        const signature = BitcoreLibCash.crypto.Signature.fromString(signatureHex);
        const pub = x.deriveChild(inputPaths[i]).publicKey;
        const s = {
          inputIndex: i,
          signature,
          sigtype: BitcoreLibCash.crypto.Signature.SIGHASH_ALL | BitcoreLibCash.crypto.Signature.SIGHASH_FORKID,
          publicKey: pub
        };
        tx.inputs[i].addSignature(tx, s, signingMethod);
        i++;
      } catch (e) {

console.log('[index.ts.795] CASH', e); // TODO
      }
    });

    if (i != tx.inputs.length) throw new Error('Wrong signatures');
  }

}
