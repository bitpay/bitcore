import { ethers } from 'ethers';
import Web3 from 'web3';
import utils, { AbiItem } from 'web3-utils';
import { Constants } from '../../constants';
import { 
  EVM_CHAIN_NETWORK_TO_CHAIN_ID as chainIds,
  EVM_CHAIN_DEFAULT_TESTNET as defaultTestnet 
} from '../../constants/chains';
import type { Key } from '../../types/derivation';
import { MULTISENDAbi } from '../erc20/abi';

const { toBN } = Web3.utils;
export class ETHTxProvider {
  chain: string;

  constructor(chain = 'ETH') {
    this.chain = chain;
  }

  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    nonce: number;
    gasPrice?: number;
    data: string;
    gasLimit: number;
    network: string;
    chainId?: number;
    contractAddress?: string;
    maxGasFee?: number;
    priorityGasFee?: number;
    txType?: number;
  }) {
    const { recipients, nonce, gasPrice, gasLimit, network, contractAddress, maxGasFee, priorityGasFee, txType } = params;
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
      for (const recipient of recipients) {
        addresses.push(recipient.address);
        amounts.push(toBN(this._valueToString(recipient.amount)));
        amount = amount.add(toBN(this._valueToString(recipient.amount)));
      }
      const multisendContract = this.getMultiSendContract(contractAddress);
      data = data || multisendContract.methods.sendEth(addresses, amounts).encodeABI();
      to = contractAddress;
    } else {
      to = recipients[0].address;
      amount = toBN(this._valueToString(recipients[0].amount));
    }
    let { chainId } = params;
    chainId = chainId || this.getChainId(network);
    const txData: any = {
      nonce: utils.toHex(nonce),
      gasLimit: utils.toHex(gasLimit),
      to,
      data,
      value: utils.toHex(amount),
      chainId
    };
    if (maxGasFee && (txType == null || txType >= 2)) {
      txData.maxFeePerGas = utils.toHex(maxGasFee);
      txData.maxPriorityFeePerGas = utils.toHex(priorityGasFee || this.getPriorityFeeMinimum(chainId));
      txData.type = 2;
    } else {
      txData.gasPrice = utils.toHex(gasPrice);
      txData.type = txType || 0;
    }

    return ethers.Transaction.from(txData).unsignedSerialized;
  }

  _valueToString(value) {
    const type = typeof value;
    if (type === 'number') {
      return (value).toLocaleString('fullwide', { useGrouping: false });
    } else if (type === 'bigint') {
      return value.toString();
    } else if (type === 'string') {
      return value;
    } else {
      throw new Error(`Unexpected type of: ${type}`);
    }
  }

  getMultiSendContract(tokenContractAddress: string) {
    const web3 = new Web3();
    return new web3.eth.Contract(MULTISENDAbi as AbiItem[], tokenContractAddress);
  }

  getPriorityFeeMinimum(chainId: number) {
    const chain = Constants.EVM_CHAIN_ID_TO_CHAIN[chainId];
    return Constants.FEE_MINIMUMS[chain]?.priority || 0;
  }

  getChainId(network: string) {
    if (network === 'testnet') {
      network = defaultTestnet[this.chain];
    }
    return chainIds[`${this.chain}_${network}`] || chainIds[`${this.chain}_mainnet`];
  }

  getSignatureObject(params: { tx: string; key: Key }) {
    const { tx, key } = params;
    // To comply with new ethers
    let k = key.privKey;
    if (k.substring(0, 2) != '0x') {
      k = '0x' + k;
    }

    const signingKey = new ethers.SigningKey(k);
    return signingKey.sign(ethers.keccak256(tx));
  }

  getSignature(params: { tx: string; key: Key }) {
    const signatureHex = this.getSignatureObject(params).serialized;
    return signatureHex;
  }

  getHash(params: { tx: string }) {
    const { tx } = params;
    // tx must be signed for hash to exist
    return ethers.Transaction.from(tx).hash;
  }

  applySignature(params: { tx: string; signature: any }) {
    const { tx, signature } = params;
    const parsedTx = ethers.Transaction.from(tx);
    const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = parsedTx;
    // backwards compatibility
    if (maxFeePerGas) {
      parsedTx.maxFeePerGas = maxFeePerGas;
      parsedTx.maxPriorityFeePerGas = maxPriorityFeePerGas;
      parsedTx.type = 2;
    } else if (!gasPrice) {
      throw new Error('either gasPrice or maxFeePerGas is required');
    }

    // Verify the signature
    let valid = false;
    let signedTx;
    try {
      parsedTx.signature = ethers.Signature.from(signature);    
      signedTx = ethers.Transaction.from(parsedTx);

      if (signedTx.hash) {
        const recoveredAddress = ethers.recoverAddress(ethers.keccak256(tx), signature);
        const expectedAddress = parsedTx.from;
        valid = recoveredAddress === expectedAddress;
      }
    } catch {}
    if (!valid) {
      throw new Error('invalid signature');
    }

    return signedTx.serialized;
  }

  sign(params: { tx: string; key: Key }) {
    const { tx, key } = params;
    const signature = this.getSignatureObject({ tx, key });
    return this.applySignature({ tx, signature });
  }
}
