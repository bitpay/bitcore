import { createHash } from 'crypto';
import { decode, encode, Wallet as XrpWallet } from 'xrpl';
import { Payment } from 'xrpl/src/models/transactions';
import { Key } from '../../derivation';

enum HashPrefix {
  // transaction plus signature to give transaction ID
  livenet = 0x54584e00,
  mainnet = 0x54584e00,
  testnet = 0x73747800
}
export class XRPTxProvider {
  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    tag?: number;
    from: string;
    invoiceID?: string;
    fee: number;
    feeRate: number;
    nonce: number;
  }) {
    const { recipients, tag, from, invoiceID, fee, nonce } = params;
    const { address, amount } = recipients[0];
    const Flags = 2147483648;
    const txJSON: Payment = {
      TransactionType: 'Payment',
      Account: from,
      Destination: address,
      Amount: amount.toString(),
      Flags,
      Fee: fee.toString(),
      Sequence: nonce
    };
    if (invoiceID) {
      txJSON.InvoiceID = invoiceID;
    }
    if (tag) {
      txJSON.DestinationTag = tag;
    }
    return encode(txJSON);
  }

  getSignatureObject(params: { tx: string; key: Key }) {
    const { tx, key } = params;
    const txJSON = (decode(tx) as unknown) as Payment;
    const signedTx = new XrpWallet(key.pubKey.toUpperCase(), key.privKey.toUpperCase()).sign(txJSON);
    return { signedTransaction: signedTx.tx_blob, hash: signedTx.hash };
  }

  getSignature(params: { tx: string; key: Key }): string {
    const { signedTransaction } = this.getSignatureObject(params);
    return signedTransaction;
  }

  getHash(params: { tx: string; network?: string }): string {
    const { tx, network = 'mainnet' } = params;
    const prefix = HashPrefix[network].toString(16).toUpperCase();
    return this.sha512Half(prefix + tx);
  }

  applySignature(params: { tx: string; signature: string }): string {
    const { signature } = params;
    return signature;
  }

  sign(params: { tx: string; key: Key }): string {
    const { tx, key } = params;
    const signature = this.getSignature({ tx, key });
    return this.applySignature({ tx, signature });
  }

  sha512Half(hex: string): string {
    return createHash('sha512')
      .update(Buffer.from(hex, 'hex'))
      .digest('hex')
      .toUpperCase()
      .slice(0, 64);
  }
}
