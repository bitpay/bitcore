import { ethers } from 'ethers';
import { Key } from '../../derivation';
const utils = require('web3-utils');
export class ETHTxProvider {
  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    nonce: number;
    gasPrice: number;
    data: string;
    gasLimit: number;
    chainId?: number;
  }) {
    const { recipients, nonce, gasPrice, data, gasLimit, chainId = 1} = params;
    const { address, amount } = recipients[0];
    const txData = {
      nonce: utils.toHex(nonce),
      gasLimit: utils.toHex(gasLimit),
      gasPrice: utils.toHex(gasPrice),
      to: address,
      data,
      value: utils.toHex(amount),
      chainId
    };
    return ethers.utils.serializeTransaction(txData);
  }

  sign(params: { tx: string; key: Key; }) {
    const { tx, key } = params;
    let wallet = new ethers.Wallet(key.privKey);
    const parsedTx = ethers.utils.parseTransaction(tx);
    return wallet.sign(parsedTx);
  }
}
