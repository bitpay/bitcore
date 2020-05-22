import { createHash } from 'crypto';
import rippleBinaryCodec from 'ripple-binary-codec';
import { RippleAPI } from 'ripple-lib';
// tslint:disable-next-line:no-submodule-imports
import { Payment } from 'ripple-lib/dist/npm/transaction/payment';
// tslint:disable-next-line:no-submodule-imports
import { Instructions, TransactionJSON } from 'ripple-lib/dist/npm/transaction/types';
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
    const { recipients, tag, from, invoiceID, fee, feeRate, nonce } = params;
    const { address, amount } = recipients[0];
    const rippleAPI = new RippleAPI();
    const { schemaValidate } = RippleAPI._PRIVATE.schemaValidator;
    const Flags = 2147483648;
    const amountStr = rippleAPI.dropsToXrp(amount);
    const feeNum = fee || feeRate;
    const feeStr = rippleAPI.dropsToXrp(feeNum.toString());
    const payment: Payment = {
      source: {
        address: from,
        maxAmount: {
          value: amountStr,
          currency: 'XRP'
        }
      },
      destination: {
        address,
        amount: {
          value: amountStr,
          currency: 'XRP'
        }
      }
    };
    const instructions: Instructions = {
      fee: feeStr,
      sequence: nonce,
      maxLedgerVersion: null
    };
    const txJSON: TransactionJSON = {
      TransactionType: 'Payment',
      Account: from,
      Destination: address,
      Amount: amount.toString(),
      Flags,
      Fee: fee.toString(),
      Sequence: nonce
    };
    if (invoiceID) {
      payment.invoiceID = invoiceID;
      txJSON.InvoiceID = invoiceID;
    }
    if (tag) {
      payment.destination.tag = tag;
      txJSON.DestinationTag = tag;
    }
    schemaValidate('preparePaymentParameters', { address: from, payment, instructions });
    schemaValidate('tx-json', txJSON);
    return rippleBinaryCodec.encode(txJSON);
  }

  getSignatureObject(params: { tx: string; key: Key }) {
    const { tx, key } = params;
    const txJSON = rippleBinaryCodec.decode(tx);
    let rippleAPI = new RippleAPI();
    const signedTx = rippleAPI.sign(JSON.stringify(txJSON), {
      privateKey: key.privKey.toUpperCase(),
      publicKey: key.pubKey.toUpperCase()
    });
    return signedTx;
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
