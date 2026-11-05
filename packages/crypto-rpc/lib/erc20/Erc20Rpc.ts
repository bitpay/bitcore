import { createRequire } from 'module';
import { ethers } from '@bitpay-labs/crypto-wallet-core';
// eslint-disable-next-line import/order
import { EthRpc } from '../eth/EthRpc.js';

const require = createRequire(import.meta.url);
const erc20 = require('./erc20.json');

export class Erc20Rpc extends EthRpc {
  constructor(config) {
    super(config);
    this.tokenContractAddress = config.tokenContractAddress;
    this.erc20Contract = new this.web3.eth.Contract(
      erc20,
      this.tokenContractAddress
    );
  }

  #getWallet(account) {
    return this.web3.eth.accounts.wallet.get(account);
  }

  // this will only work on ERC20 tokens with decimals
  async sendToAddress({ address, amount, fromAccount, gasPrice, nonce, gas }) {
    if (!gasPrice) {
      gasPrice = await this.estimateGasPrice();
    }
    const account = fromAccount || this.getAccount();
    const amountStr = Number(amount).toLocaleString('fullwide', { useGrouping: false });
    const contractData = this.erc20Contract.methods
      .transfer(address, amountStr)
      .encodeABI();

    const sendParams = {
      from: account,
      gasPrice,
      data: contractData,
      to: this.tokenContractAddress,
      nonce,
      gas
    };


    if (!gas) {
      const estimatedGas = await this.web3.eth.estimateGas(sendParams);
      sendParams.gas = estimatedGas; 
    }

    if (nonce == null) {
      sendParams.nonce = await this.getTransactionCount({ address: account });
    }

    const wallet = this.#getWallet(account);
    if (!wallet) {
      throw new Error('Account not found. Make sure you add it first with addAccount()');
    }

    const signed = await wallet.signTransaction(sendParams);
    const txid = await this.sendRawTransaction({ rawTx: signed.rawTransaction });
    return txid;
  }

  async getBalance({ address }) {
    if (address) {
      const balance = await this.erc20Contract.methods
        .balanceOf(address)
        .call();
      return balance;
    } else {
      const balances = await Promise.all(Array.from({ length: this.web3.eth.accounts.wallet.length }, async (_, idx) => {
        const address = this.web3.eth.accounts.wallet[idx].address;
        const balance = await this.getBalance({ address });
        return { account: address, balance };
      }));
      return balances;
    }
  }

  async decodeRawTransaction({ rawTx }) {
    const decodedEthTx = await super.decodeRawTransaction({ rawTx });
    if (decodedEthTx.data) {
      try {
        const erc20Interface = new ethers.Interface(erc20);
        decodedEthTx.decodedData = await erc20Interface.parseTransaction({ data: decodedEthTx.data });
      } catch {
        decodedEthTx.decodedData = undefined;
      }
    }
    return decodedEthTx;
  }
}