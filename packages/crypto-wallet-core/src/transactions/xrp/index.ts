import { RippleAPI } from 'ripple-lib';
// tslint:disable-next-line:no-submodule-imports
import { Payment } from 'ripple-lib/dist/npm/transaction/payment';
// tslint:disable-next-line:no-submodule-imports
import { Instructions } from 'ripple-lib/dist/npm/transaction/types';
import { Key } from '../../derivation';

export class XRPTxProvider {
  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    data: string;
    tag: number;
    sourceAddress: string;
    invoiceID: string;
    fee: string;
    nonce: number;
  }) {
    const { recipients, tag, sourceAddress, invoiceID, fee, nonce } = params;
    const { address, amount } = recipients[0];
    const payment: Payment = {
      source: {
        address: sourceAddress,
        tag: tag || undefined,
        maxAmount: {
          value: amount.toString(),
          currency: 'XRP'
        }
      },
      destination: {
        address,
        tag: tag || undefined,
        amount: {
          value: amount.toString(),
          currency: 'XRP'
        }
      },
      invoiceID: invoiceID || undefined,
    };

    const instructions: Instructions = {
      fee,
      sequence: nonce,
      maxLedgerVersion: null,
    };

    let rippleAPI = new RippleAPI();
    return rippleAPI.preparePayment(sourceAddress, payment, instructions).then((preparedTx) => {
      return preparedTx.txJSON;
    }).catch((err) => {
      return;
    });
  }

  sign(params: { tx: string; key: Key; }) {
    const { tx, key } = params;
    const txJSON = tx;
    let rippleAPI = new RippleAPI();
    const signedTx = rippleAPI.sign(txJSON, {
      privateKey: key.privKey,
      publicKey: key.pubKey,
    });
    return signedTx;
  }
}
