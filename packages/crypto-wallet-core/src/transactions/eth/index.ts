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
    const signingKey = new ethers.utils.SigningKey(key.privKey);
    const signDigest = signingKey.signDigest.bind(signingKey);
    const signature = signDigest(ethers.utils.keccak256(tx));
    const parsedTx = ethers.utils.parseTransaction(tx);
    const { nonce, gasPrice, gasLimit, to, value, data, chainId } = parsedTx;
    const txData = { nonce: utils.toHex(nonce), gasPrice: utils.toHex(gasPrice), gasLimit: utils.toHex(gasLimit), to, value: utils.toHex(value), data, chainId };
    const signedTx = ethers.utils.serializeTransaction(txData, signature);
    return signedTx;
  }
}
