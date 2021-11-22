import { ethers } from 'ethers';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Key } from '../../derivation';
import { ERC20Abi, MULTISENDAbi } from '../erc20/abi';
const utils = require('web3-utils');
const { toBN } = Web3.utils;
export class ETHTxProvider {
  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    nonce: number;
    gasPrice: number;
    data: string;
    gasLimit: number;
    network: string;
    chainId?: number;
    contractAddress?: string;
  }) {
    const { recipients, nonce, gasPrice, gasLimit, network, contractAddress } = params;
    let { data } = params;
    let to;
    let amount;
    if (recipients.length > 1) {
      if (!contractAddress) {
        throw new Error('Multiple recipients requires use of multi-send contract, please specify contractAddress');
      }
      const addresses = [];
      const amounts = [];
      amount = toBN(0);
      for (let recipient of recipients) {
        addresses.push(recipient.address);
        amounts.push(toBN(recipient.amount));
        amount = amount.add(toBN(recipient.amount));
      }
      const multisendContract = this.getMultiSendContract(contractAddress);
      data = data || multisendContract.methods.sendEth(addresses, amounts).encodeABI();
      to = contractAddress;
    } else {
      to = recipients[0].address;
      amount = recipients[0].amount;
    }
    let { chainId } = params;
    chainId = chainId || this.getChainId(network);
    const txData = {
      nonce: utils.toHex(nonce),
      gasLimit: utils.toHex(gasLimit),
      gasPrice: utils.toHex(gasPrice),
      to,
      data,
      value: utils.toHex(amount),
      chainId
    };
    return ethers.utils.serializeTransaction(txData);
  }

  getMultiSendContract(tokenContractAddress: string) {
    const web3 = new Web3();
    return new web3.eth.Contract(MULTISENDAbi as AbiItem[], tokenContractAddress);
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
    if (k.substr(0, 2) != '0x') {
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
