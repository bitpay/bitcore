import EthereumTx from 'ethereumjs-tx';
import { Key } from '../../derivation';
const utils = require('web3-utils');
export class ETHTxProvider {
  lib = require('bitcore-lib');

  async create(params: {
    recipients: Array<{ address: string; amount: string }>;
    from: string;
    nonce: number;
    fee: number;
    data: string;
    gasLimit: number;
  }) {
    const { recipients, from, nonce, fee, data } = params;
    const { address, amount } = recipients[0];
    const txData = {
      nonce,
      gasLimit: utils.toHex(25000),
      gasPrice: utils.toHex(fee),
      to: address,
      from,
      data,
      value: utils.toHex(utils.toWei(amount, 'wei'))
    };
    const rawTx = new EthereumTx(txData).serialize().toString('hex');
    return rawTx;
  }

  async sign(params: { tx: string; key: Key; from: string }) {
    const { tx, key, from } = params;
    const rawTx = new EthereumTx(tx);
    const address = from.toLowerCase();
    try {
      const bufferKey = Buffer.from(key.privKey, 'hex');
      rawTx.sign(bufferKey);
      const serializedTx = rawTx.serialize();
      return '0x' + serializedTx.toString('hex');
    } catch (err) {
      console.log(err);
    }
  }
}
