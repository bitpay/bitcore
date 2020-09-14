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
    network: string;
    chainId?: number;
  }) {
    const { recipients, nonce, gasPrice, data, gasLimit, network } = params;
    const { address, amount } = recipients[0];
    let { chainId } = params;
    chainId = chainId || this.getChainId(network);
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

  getChainId(network: string) {
    let chainId = 1;
    switch (network) {
      case 'testnet':
      case 'kovan':
        chainId = 42;
        break;
      case 'ropsten':
        chainId = 3;
        break;
      case 'rinkeby':
        chainId = 4;
        break;
      case 'regtest':
        chainId = 17;
        break;
      default:
        chainId = 1;
        break;
    }
    return chainId;
  }

  getSignatureObject(params: { tx: string; key: Key }) {
    const { tx, key } = params;
    // To complain with new ethers
    let k = key.privKey;
    if (k.substr(0,2) != '0x') {
      k = '0x' + k;
    }

    const signingKey = new ethers.utils.SigningKey(k);
    const signDigest = signingKey.signDigest.bind(signingKey);
    return signDigest(ethers.utils.keccak256(tx));
  }

  getSignature(params: { tx: string; key: Key }) {
    const signatureHex = ethers.utils.joinSignature(this.getSignatureObject(params));
    return signatureHex;
  }

  getHash(params: { tx: string }) {
    const { tx } = params;
    // tx must be signed, for hash to exist
    return ethers.utils.parseTransaction(tx).hash;
  }

  applySignature(params: { tx: string; signature: any }) {
    let { tx, signature } = params;
    const parsedTx = ethers.utils.parseTransaction(tx);
    const { nonce, gasPrice, gasLimit, to, value, data, chainId } = parsedTx;
    const txData = { nonce, gasPrice, gasLimit, to, value, data, chainId };
    if (typeof signature == 'string') {
      signature = ethers.utils.splitSignature(signature);
    }
    const signedTx = ethers.utils.serializeTransaction(txData, signature);
    const parsedTxSigned = ethers.utils.parseTransaction(signedTx);
    if (!parsedTxSigned.hash) {
      throw new Error('Signature invalid');
    }
    return signedTx;
  }

  sign(params: { tx: string; key: Key }) {
    const { tx, key } = params;
    const signature = this.getSignatureObject({ tx, key });
    return this.applySignature({ tx, signature });
  }
}
