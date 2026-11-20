import { type Web3, type Web3Types, ethers } from '@bitpay-labs/crypto-wallet-core';
import { type EthDecodedTransaction, EthRpc, type EthRpcConfig, type EthSendToAddressParams } from '../eth/EthRpc';
import erc20 from './erc20.json';

export interface Erc20RpcConfig extends EthRpcConfig {
  tokenContractAddress: string;
}

export interface Erc20DecodedTransaction extends EthDecodedTransaction {
  /** The parsed ERC20 call, or undefined/null when the data is not one */
  decodedData?: ethers.TransactionDescription | null;
}

export class Erc20Rpc extends EthRpc {
  tokenContractAddress: string;
  erc20Contract: InstanceType<Web3['eth']['Contract']>;

  constructor(config: Erc20RpcConfig) {
    super(config);
    this.tokenContractAddress = config.tokenContractAddress;
    this.erc20Contract = new this.web3.eth.Contract(
      erc20,
      this.tokenContractAddress
    );
  }

  #getWallet(account: string) {
    return this.web3.eth.accounts.wallet.get(account);
  }

  // this will only work on ERC20 tokens with decimals
  async sendToAddress({ address, amount, fromAccount, gasPrice, nonce, gas }: EthSendToAddressParams): Promise<string> {
    if (!gasPrice) {
      gasPrice = await this.estimateGasPrice();
    }
    const account = (fromAccount || this.getAccount())!;
    const amountStr = Number(amount).toLocaleString('fullwide', { useGrouping: false });
    const contractData = this.erc20Contract.methods
      .transfer(address, amountStr)
      .encodeABI();

    const sendParams: Web3Types.Transaction = {
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

  async getBalance({ address }: { address?: string }) {
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

  // TODO: EthRpc's decodeRawTransaction is sync and
  // sendRawTransaction reads .txid off its result to handle "already known"
  // errors. This async override makes that read undefined for tokens.
  // @ts-expect-error async override of a sync base method; kept to preserve behavior
  async decodeRawTransaction({ rawTx }: { rawTx: string }): Promise<Erc20DecodedTransaction> {
    const decodedEthTx: Erc20DecodedTransaction = await super.decodeRawTransaction({ rawTx });
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