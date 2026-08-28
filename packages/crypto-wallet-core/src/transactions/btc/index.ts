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
    recipients: Array<{ amount: number | string }>,
    utxos: EveryUtxoType[],
    fee?: number
  ): EveryUtxoType[] {
    // Only sort by block height if utxos are bitcore-node style
    if (utxos.length > 0 && utxos[0].mintHeight != undefined) {
      utxos = utxos.sort(function(a, b) {
        return a.mintHeight - b.mintHeight;
      });
    }

    let index = 0;
    let utxoSum = 0;
    const recepientSum = recipients.reduce((sum, cur) => sum + Number(cur.amount), fee || 0);
    while (utxoSum < recepientSum) {
      assert(index < utxos.length, 'insufficient funds');
      const utxo = utxos[index];
      utxoSum += Number(utxo.value ?? utxo.satoshis ?? this.lib.Unit.fromBTC(utxo.amount).toSatoshis());
      index += 1;
    }
    const filteredUtxos = utxos.slice(0, index);
    return filteredUtxos;
  }

  /**
   * Standardize utxo for internal funcionality.
   * Accepts either a bitcore-node or a lib (bitcore-lib, bitcore-lib-cash, etc.) utxo.
   * Handles both lib style utxos: UnspentOutput properties and UnspentOutput.toObject properties.
   *
   * @param utxos either a bitcore-node or lib utxo
   * @returns utxo in the standard, internaly used format
   */
  standardizeUtxo(utxo: EveryUtxoType): UtxoType {
    return {
      satoshis: Number(utxo.satoshis ?? utxo.value ?? this.lib.Unit.fromBTC(utxo.amount ?? 0).toSatoshis()),
      txId: utxo.txId ?? utxo.mintTxid ?? utxo.txid,
      outputIndex: Number(utxo.outputIndex ?? utxo.mintIndex ?? utxo.vout ?? 0),
      script: utxo.scriptPubKey ?? new this.lib.Script(utxo.script).toHex(),
      address: utxo.address != undefined ? new this.lib.Address(utxo.address).toString() : undefined
    };
  }

  create(params: BtcCreateParams): string {
    const { recipients, utxos = [], change, feeRate, fee, isSweep, replaceByFee, lockUntilDate, lockUntilBlock } = params;
    const filteredUtxos = isSweep ? utxos : this.selectCoins(recipients, utxos, Number(fee));
    const btcUtxos = filteredUtxos.map(utxo => this.standardizeUtxo(utxo));
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
      tx.to(recipient.address, Number(recipient.amount));
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

  transformSignatureObject(params: BtcTransformSignatureObjectParams): string {
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

  applySignature(params: BtcApplySignatureParams): BitcoreLib.Transaction {
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

  getHash(params: BtcGetHashParams): string {
    const bitcoreTx = new this.lib.Transaction(params.tx);
    return bitcoreTx.hash;
  }

  sign(params: BtcSignParams): string {
    const { tx, keys, pubkeys, threshold, opts } = params;
    const utxos = params.utxos || [];
    const bitcoreTx = new this.lib.Transaction(tx);
    const btcUtxos = utxos.map(utxo => this.standardizeUtxo(utxo));
    const applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos: btcUtxos
    });
    bitcoreTx.associateInputs(applicableUtxos.map(utxo => new this.lib.Transaction.UnspentOutput(utxo)), pubkeys, threshold, opts);
    const uniqePrivKeys = Object.values(keys.reduce((map, key) => {
      // Need to preserve (un)compressed property, so don't use key.privKey.toString();
      const pk = new this.lib.PrivateKey(key.privKey);
      map[pk.publicKey.toString()] = pk;
      return map;
    }, {}));
    const signedTx = bitcoreTx.sign(uniqePrivKeys).toString();
    return signedTx;
  }

  getRelatedUtxos(params: {
    outputs: BitcoreLib.Transaction.Input[];
    utxos: UtxoType[];
  }): UtxoType[] {
    const { outputs, utxos } = params;
    const txids = outputs.map(output => output.toObject().prevTxId);
    return utxos.filter(utxo => txids.includes(utxo.txId));
  }

  getOutputsFromTx(params: {
    tx: BitcoreLib.Transaction;
  }): Array<{ address: string | BitcoreLib.Script; satoshis: number }> {
    return params.tx.outputs.map(({ script, satoshis }) => {
      const address = script;
      return { address, satoshis };
    });
  }

  getSigningAddresses(params: {
    tx: TransactionType;
    utxos: EveryUtxoType[];
  }): (string | undefined)[] {
    const { tx, utxos } = params;
    const bitcoreTx = new this.lib.Transaction(tx);
    const btcUtxos = utxos.map(utxo => this.standardizeUtxo(utxo));
    const applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos: btcUtxos
    });
    return applicableUtxos.map(utxo => utxo.address);
  }

  getSighash(params: BtcGetSighashParams): string {
    const { index, utxos, path, sigtype, pubKeys, threshold, opts } = params;
    let { tx, pubKey } = params;
    
    if (!(tx instanceof this.lib.Transaction)) {
      tx = new this.lib.Transaction(tx);
    }
    if (utxos) {
      const btcUtxos = utxos.map(utxo => this.standardizeUtxo(utxo));
      tx.associateInputs(btcUtxos.map(utxo => new this.lib.Transaction.UnspentOutput(utxo)), pubKeys, threshold, opts);
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

/** Transaction data that can be converted into a Transaction via Transaction(tx) */
type TransactionType = BitcoreLib.Transaction | string | Buffer | object;

/**
 * Standard utxo type use for internal processing.
 * Property names are from bitcore-lib's UnspentOutput.
 * Note, UnspentOutput addresses and scripts are Address and Script classes respectively,
 * here they are both strings.
 */
export type UtxoType = {
  txId: string;
  outputIndex: number;
  satoshis: number;
  script: string;
  address?: string;
};

/** 
 * Utxo type for functions were the received utxo type is unknown.
 * Could either be in the format of UnspentOutput, UnspentOutput.toObject, or from bitcore-node.
 */
export type EveryUtxoType = Partial<UtxoType & {
  // bitcore-node specific properties
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  value: number;
  // UnspentOutput.toObject specific properties
  txid: string;
  amount: number;
  vout: number;
  scriptPubKey: string;
  // UnspentOutput specific, allow for Script and Address objects
  script: string | BitcoreLib.Script;
  address: string | BitcoreLib.Address;
}>;

export interface BtcCreateParams {
  recipients: Array<{ address: string; amount: number | string }>;
  utxos?: EveryUtxoType[];
  change?: string;
  feeRate?: number | string;
  fee?: number | string;
  isSweep?: boolean;
  replaceByFee?: boolean;
  lockUntilDate?: number;
  lockUntilBlock?: number;
};

export interface BtcSignParams {
  tx: TransactionType;
  keys: Key[];
  utxos: EveryUtxoType[];
  pubkeys?: any[];
  threshold?: number;
  opts?: any;
};

export interface BtcApplySignatureParams {
  tx: BitcoreLib.Transaction;
  signature: SignatureType;
  index: number;
  sigtype?: number;
};

export interface BtcGetHashParams { tx: TransactionType };

export interface BtcTransformSignatureObjectParams { obj: any; sigtype?: number };

export interface BtcGetSighashParams {
  tx: TransactionType;
  index: number;
  utxos?: EveryUtxoType[];
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
};
