import { createHash } from 'crypto';
import * as RBC from 'ripple-binary-codec';
import * as binary from 'ripple-binary-codec/dist/binary';
import { HashPrefix } from 'ripple-binary-codec/dist/hash-prefixes';
import * as xrpl from 'xrpl';
import * as Utils from '../../utils';
import { BTCTxProvider } from '../btc';
import type { Key } from '../../types/derivation';

export class XRPTxProvider {
  create(params: {
    recipients: Array<{ address: string; amount: string; tag?: number }>;
    tag?: number;
    from: string;
    invoiceID?: string;
    fee: number;
    feeRate: number;
    nonce: number;
    txType?: string;
    flags?: number | string;
  }) {
    const {
      recipients,
      tag,
      from,
      invoiceID,
      fee,
      nonce,
      // `params.type` is an old param to fallback to.
      // Changed to txType to re-use similar property name from other chains (e.g. EVM)
      txType = params['type'],
      flags,
    } = params;

    switch (txType?.toLowerCase()) {
      case 'payment':
      default:
        const { address, amount } = recipients[0];
        const _tag = recipients[0]?.tag || tag;
        const paymentTx: xrpl.Payment = {
          TransactionType: 'Payment',
          Account: from,
          Destination: address,
          Amount: amount.toString(),
          Fee: fee.toString(),
          Sequence: nonce,
          Flags: 2147483648 // tfFullyCanonicalSig - DEPRECATED but still here for backward compatibility
        };
        if (flags != null) {
          paymentTx.Flags = this.transformFlags<xrpl.PaymentFlagsInterface>(flags);
          xrpl.setTransactionFlagsToNumber(paymentTx);
        }
        if (invoiceID) {
          paymentTx.InvoiceID = invoiceID;
        }
        if (_tag) {
          paymentTx.DestinationTag = _tag;
        }
        return xrpl.encode(paymentTx);
      case 'accountset':
        const accountSetTx: xrpl.AccountSet = {
          TransactionType: 'AccountSet',
          Account: from,
          Flags: this.transformFlags<xrpl.AccountSetFlagsInterface>(flags),
          Fee: fee.toString(),
          Sequence: nonce
        };
        xrpl.setTransactionFlagsToNumber(accountSetTx);
        return xrpl.encode(accountSetTx);
      case 'accountdelete':
        const accountDeleteTx: xrpl.AccountDelete = {
          TransactionType: 'AccountDelete',
          Account: from,
          Destination: recipients[0].address,
          DestinationTag: recipients[0].tag,
          Fee: fee.toString(),
          Sequence: nonce
        };
        return xrpl.encode(accountDeleteTx);
    }
  }

  getSignatureObject(params: { tx: string; key: Key }) {
    const { tx, key } = params;
    const txJSON = (xrpl.decode(tx) as unknown) as xrpl.Payment;
    const signedTx = new xrpl.Wallet(key.pubKey.toUpperCase(), key.privKey.toUpperCase()).sign(txJSON);
    return { signedTransaction: signedTx.tx_blob, hash: signedTx.hash };
  }

  getSignature(params: { tx: string; key: Key }): string {
    const { signedTransaction } = this.getSignatureObject(params);
    const decoded = (xrpl.decode(signedTransaction) as any) as xrpl.Transaction;
    return decoded.TxnSignature;
  }

  getHash(params: { tx: string }): string {
    const { tx } = params;
    const prefix = HashPrefix.transactionID.toString('hex').toUpperCase();
    return this.sha512Half(prefix + tx);
  }

  applySignature(params: { tx: string; signature: string; pubKey: string }): string {
    const { tx, signature, pubKey } = params;
    const txJSON = (xrpl.decode(tx) as any) as xrpl.Transaction;
    txJSON.TxnSignature = signature;
    txJSON.SigningPubKey = pubKey;
    const signedTx = xrpl.encode(txJSON);
    return signedTx;
  }

  sign(params: { tx: string; key: Key }): string {
    const { tx, key } = params;
    const signature = this.getSignature({ tx, key });
    return this.applySignature({ tx, signature, pubKey: key.pubKey });
  }

  sha512Half(hex: string): string {
    return createHash('sha512')
      .update(Buffer.from(hex, 'hex'))
      .digest('hex')
      .toUpperCase()
      .slice(0, 64);
  }

  transformSignatureObject(params: { obj: any }) {
    const { obj } = params;
    return new BTCTxProvider().transformSignatureObject({ obj });
  }

  getSighash(params: { tx: string; pubKey: string }) {
    const { tx, pubKey } = params;
    const decoded = RBC.decode(tx);
    decoded.SigningPubKey = pubKey;
    const encoded = binary.serializeObject(decoded, {
      prefix: HashPrefix.transactionSig,
      signingFieldsOnly: true
    }).toString('hex');
    return this.sha512Half(encoded);
  }

  private transformFlags<T extends xrpl.PaymentFlagsInterface | xrpl.AccountSetFlagsInterface>(flags: string | number): T | number {
    if (flags == null) {
      throw new Error('No XRP flag(s) provided');
    }
    if (typeof flags === 'number') {
      // Pass through numbers since they may be combined flags
      return flags;
    }
    return flags.split(',').reduce((acc, flag) => {
      const flagValue = Utils.normalizeXrpFlag(flag.trim());
      acc[flagValue] = true;
      return acc;
    }, {} as T);
  }
}