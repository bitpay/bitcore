import assert from 'assert';
import BitcoreLib from 'bitcore-lib';
import type { Key } from '../../types/derivation';

const $ = BitcoreLib.util.preconditions;

interface TssSig {
  r: string;
  s: string;
  v: number;
  pubKey: string;
};

export class BTCTxProvider {
  lib = BitcoreLib;

  selectCoins(
    recipients: Array<{ amount: number }>,
    utxos: Array<{
      value: number;
      mintHeight: number;
      txid?: string;
      mintTxid?: string;
      mintIndex?: number;
    }>,
    fee: number
  ) {
    utxos = utxos.sort(function(a, b) {
      return a.mintHeight - b.mintHeight;
    });

    let index = 0;
    let utxoSum = 0;
    let recepientSum = recipients.reduce((sum, cur) => sum + Number(cur.amount), fee || 0);
    while (utxoSum < recepientSum) {
      const utxo = utxos[index];
      utxoSum += Number(utxo.value);
      index += 1;
    }
    const filteredUtxos = utxos.slice(0, index);
    return filteredUtxos;
  }

  create({ recipients, utxos = [], change, feeRate, fee, isSweep, replaceByFee, lockUntilDate, lockUntilBlock }) {
    const filteredUtxos = isSweep ? utxos : this.selectCoins(recipients, utxos, fee);
    const btcUtxos = filteredUtxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / 1e8,
        txid: utxo.mintTxid,
        outputIndex: utxo.mintIndex
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
    let tx = new this.lib.Transaction().from(btcUtxos);
    if (fee) {
      tx.fee(fee);
    }
    if (feeRate) {
      tx.feePerByte(Number(feeRate));
    }
    if (change) {
      tx.change(change);
    }
    for (const recipient of recipients) {
      tx.to(recipient.address, parseInt(recipient.amount));
    }
    if (replaceByFee && typeof tx.enableRBF === 'function') {
      tx.enableRBF();
    }
    if (lockUntilBlock > 0) {
      tx.lockUntilBlockHeight(lockUntilBlock);
    } else if (lockUntilDate > 0) {
      tx.lockUntilDate(lockUntilDate);
    }
    return tx.uncheckedSerialize();
  }

  getSignature(params: { tx: string; keys: Array<Key> }) {
    throw new Error('function getSignature not implemented for UTXO coins');
  }

  transformSignatureObject(params: { obj: any; sigtype?: number }) {
    const { obj, sigtype } = params;
    let { r, s, v, i, nhashtype } = obj;
    if (typeof r === 'string') {
      r = Buffer.from(r.startsWith('0x') ? r.slice(2) : r, 'hex');
    } else if (r instanceof Uint8Array || Array.isArray(r)) {
      r = Buffer.from(r);
    } else if (typeof r.toBuffer === 'function') {
      r = r.toBuffer();
    }
    r = this.lib.crypto.BN.fromBuffer(r);

    if (typeof s === 'string') {
      s = Buffer.from(s.startsWith('0x') ? s.slice(2) : s, 'hex');
    } else if (s instanceof Uint8Array || Array.isArray(s)) {
      s = Buffer.from(s);
    } else if (typeof s.toBuffer === 'function') {
      s = s.toBuffer();
    }
    s = this.lib.crypto.BN.fromBuffer(s);

    i = parseInt(i) || parseInt(v);
    nhashtype = sigtype ?? nhashtype;

    return new this.lib.crypto.Signature({ r, s, i, nhashtype }).toString();
  }

  applySignature(params: { tx: BitcoreLib.Transaction; signature: SignatureType; index: number; sigtype?: number; }) {
    const { index, sigtype } = params;
    let { tx, signature } = params;
    assert(tx instanceof this.lib.Transaction, 'tx must be an instance of Transaction');
    assert(signature instanceof this.lib.Transaction.Signature || (signature?.r && signature?.s), 'signature must be a valid signature object');

    if (signature.r) {
      const nhashtype = sigtype ?? signature.sigtype ?? signature.nhashtype ?? this.lib.crypto.Signature.SIGHASH_ALL;
      signature = new this.lib.Transaction.Signature({
        publicKey: signature.pubKey,
        inputIndex: index,
        outputIndex: tx.inputs[index].outputIndex,
        prevTxId: tx.inputs[index].prevTxId,
        signature: this.transformSignatureObject({ obj: signature, sigtype: nhashtype }),
        sigtype: nhashtype,
      });
    }
    tx.applySignature(signature);
    return tx;
  }

  getHash(params: { tx: string }) {
    const bitcoreTx = new this.lib.Transaction(params.tx);
    return bitcoreTx.hash;
  }

  sign(params: { tx: string; keys: Array<Key>; utxos: any[]; pubkeys?: any[]; threshold?: number; opts: any }) {
    const { tx, keys, pubkeys, threshold, opts } = params;
    let utxos = params.utxos || [];
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    bitcoreTx.associateInputs(applicableUtxos, pubkeys, threshold, opts);
    const uniqePrivKeys = Object.values(keys.reduce((map, key) => {
      // Need to preserve (un)compressed property, so don't use key.privKey.toString();
      const pk = new this.lib.PrivateKey(key.privKey);
      map[pk.publicKey.toString()] = pk;
      return map;
    }, {}));
    const signedTx = bitcoreTx.sign(uniqePrivKeys).toString();
    return signedTx;
  }

  getRelatedUtxos({ outputs, utxos }) {
    let txids = outputs.map(output => output.toObject().prevTxId);
    let applicableUtxos = utxos.filter(utxo => txids.includes(utxo.txid || utxo.mintTxid));
    return applicableUtxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / Math.pow(10, 8),
        txid: utxo.mintTxid,
        outputIndex: utxo.mintIndex
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
  }

  getOutputsFromTx({ tx }) {
    return tx.outputs.map(({ script, satoshis }) => {
      let address = script;
      return { address, satoshis };
    });
  }

  getSigningAddresses({ tx, utxos }): string[] {
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    return applicableUtxos.map(utxo => utxo.address);
  }

  getSighash(params: {
    tx: string | BitcoreLib.Transaction;
    index: number;
    utxos?: BitcoreLib.Transaction.UnspentOutput[];
    pubKey?: string | BitcoreLib.PublicKey | BitcoreLib.HDPublicKey;
    path?: string;
    sigtype?: number;
    // Multisig params for `associateInputs()`
    /** Multisig public keys */
    pubKeys?: string[] | BitcoreLib.PublicKey[];
    /** Threshold for multisig */
    threshold?: number;
    /** Options for multisig */
    opts?: any;
    // end Multisig params for `associateInputs()`
  }): string {
    const { index, utxos, path, sigtype, pubKeys, threshold, opts } = params;
    let { tx, pubKey } = params;
    
    if (!(tx instanceof this.lib.Transaction)) {
      tx = new this.lib.Transaction(tx);
    }
    if (utxos) {
      tx.associateInputs(utxos.map(this.lib.Transaction.UnspentOutput), pubKeys, threshold, opts);
    }
    $.checkState(tx.inputs[index].output instanceof this.lib.Transaction.Output, 'Input must have all utxo info');

    pubKey = pubKey?.toString();
    if (pubKey) {
      try {
        pubKey = new this.lib.PublicKey(pubKey);
      } catch {
        $.checkArgument(path, '`path` param is required to derive child key');
        pubKey = new this.lib.HDPublicKey(pubKey).deriveChild(path).publicKey;
      }
    }
    // Not all input types require the public key
    $.checkState(!pubKey || pubKey instanceof this.lib.PublicKey, 'Invalid public key');

    return tx.inputs[index].getSighash(tx, pubKey, index, sigtype).toString('hex');
  }
}

type SignatureType = BitcoreLib.Transaction.Signature | BitcoreLib.crypto.Signature | TssSig;