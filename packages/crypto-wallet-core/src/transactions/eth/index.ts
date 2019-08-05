import EthereumTx from 'ethereumjs-tx';
import { Key } from '../../derivation';
const utils = require('web3-utils');
export class ETHTxProvider {
  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    from: string;
    nonce: number;
    fee: number;
    data: string;
    gasLimit: number;
  }) {
    const { recipients, from, nonce, fee, data, gasLimit } = params;
    const { address, amount } = recipients[0];
    const txData = {
      nonce: utils.toHex(nonce),
      gasLimit: utils.toHex(gasLimit),
      gasPrice: utils.toHex(fee),
      to: address,
      data,
      value: utils.toHex(amount)
    };
    const rawTx = new EthereumTx(txData).serialize().toString('hex');
    return rawTx;
  }

  sign(params: { tx: string; key: Key; from: string }) {
    const { tx, key, from } = params;
    const rawTx = new EthereumTx(tx);
    const address = from.toLowerCase();
    const bufferKey = Buffer.from(key.privKey, 'hex');
    rawTx.sign(bufferKey);
    const serializedTx = rawTx.serialize();
    return '0x' + serializedTx.toString('hex');
  }
}
