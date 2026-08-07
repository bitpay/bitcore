import assert from 'assert';
import BitcoreLib from '@bitpay-labs/bitcore-lib';
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
    utxos: UtxoType[],
    fee: number
  ) {
    // Only sort by block height if utxos are bitcore-node style
    if (this.isNodeUtxo(utxos[0])) {
      utxos = utxos.sort(function(a, b) {
        return a.mintHeight - b.mintHeight;
      });
    }

    let index = 0;
    let utxoSum = 0;
    const recepientSum = recipients.reduce((sum, cur) => sum + Number(cur.amount), fee || 0);
    while (utxoSum < recepientSum) {
      const utxo = utxos[index];
      utxoSum += Number(utxo.value ?? utxo.satoshis);
      index += 1;
    }
    const filteredUtxos = utxos.slice(0, index);
    return filteredUtxos;
  }

  create(params: {
    recipients: Array<{ address: string; amount: number }>;
    utxos: UtxoType[];
    change: string;
    feeRate: number;
    fee: number;
    isSweep: boolean;
    replaceByFee: boolean;
    lockUntilDate: number;
    lockUntilBlock: number;
  }) {
    const { recipients, utxos = [], change, feeRate, fee, isSweep, replaceByFee, lockUntilDate, lockUntilBlock } = params;
    const filteredUtxos = isSweep ? utxos : this.selectCoins(recipients, utxos, fee);
    const btcUtxos = this.isNodeUtxo(utxos[0]) ? this.nodeToLibUtxos(filteredUtxos) : filteredUtxos;
    const tx = new this.lib.Transaction().from(btcUtxos);
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
      tx.to(recipient.address, parseInt(recipient.amount as any));
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

  getSignature() {
    throw new Error('function getSignature not implemented for UTXO coins');
  }

  transformSignatureObject(params: { obj: any; sigtype?: number }) {
    const { obj, sigtype } = params;
    const { v } = obj;
    let { r, s, i, nhashtype } = obj;
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

  applySignature(params: { tx: BitcoreLib.Transaction; signature: SignatureType; index: number; sigtype?: number }) {
    const { index, sigtype, tx } = params;
    let { signature } = params;
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

  sign(params: { tx: string; keys: Array<Key>; utxos: UtxoType[]; pubkeys?: any[]; threshold?: number; opts: any }) {
    const { tx, keys, pubkeys, threshold, opts } = params;
    const utxos = params.utxos || [];
    const bitcoreTx = new this.lib.Transaction(tx);
    const applicableUtxos = this.getRelatedUtxos({
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

  /**
   * Converts the utxos in a bitcore-nodes database to bitcore lib utxos
   * 
   * @param utxos bitcore-node style utxos
   * @returns lib style utxos
   */
  nodeToLibUtxos(utxos: NodeUtxoType[]): BitcoreLib.Transaction.UnspentOutput[] {
    return utxos.map(utxo => new this.lib.Transaction.UnspentOutput({
      satoshis: utxo.value,
      // bitcore-node utxos have both mintTxid and spentTxid
      txid: utxo.mintTxid,
      outputIndex: utxo.mintIndex,
      script: utxo.script,
      address: utxo.address
    }));
  }

  /**
   * Return true if utxo is a bitcore-node utxo
   * 
   * @param utxo either a bitcore-lib or bitcore-node utxo
   * @returns true if node utxo
   */
  isNodeUtxo(utxo: UtxoType): boolean {
    return utxo.mintTxid != undefined;
  }

  getRelatedUtxos(params: { outputs: any[]; utxos: UtxoType[] }) {
    const { outputs, utxos } = params;
    const txids = outputs.map(output => output.toObject().prevTxId);
    const applicableUtxos = utxos.filter(utxo => txids.includes(utxo.txid || utxo.mintTxid));
    return this.isNodeUtxo(utxos[0]) ? this.nodeToLibUtxos(applicableUtxos) : applicableUtxos;
  }

  getOutputsFromTx({ tx }) {
    return tx.outputs.map(({ script, satoshis }) => {
      const address = script;
      return { address, satoshis };
    });
  }

  getSigningAddresses(params: { tx: string | BitcoreLib.Transaction; utxos: UtxoType[] }): string[] {
    const { tx, utxos } = params;
    const bitcoreTx = new this.lib.Transaction(tx);
    const applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    return applicableUtxos.map(utxo => utxo.address);
  }

  getSighash(params: {
    tx: string | BitcoreLib.Transaction;
    index: number;
    utxos?: UtxoType[];
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
      tx.associateInputs(this.isNodeUtxo(utxos[0]) ? this.nodeToLibUtxos(utxos) : utxos, pubKeys, threshold, opts);
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
// bitcore-node style utxo minus values that are not used
type NodeUtxoType = {
  // network: string;
  // chain: string;
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  // coinbase: boolean;
  value: number;
  address: string;
  script: string;
  // spentTxid: string;
  // spentHeight?: number;
  // confirmations?: number;
  // sequenceNumber?: number;
}
// utxo type recieved externaly from this class that could either be from bitcore-node or already a lib utxo
type UtxoType = NodeUtxoType | BitcoreLib.Transaction.UnspentOutput;
