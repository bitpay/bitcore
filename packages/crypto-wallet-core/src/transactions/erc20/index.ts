import Web3 from 'web3';
import { ETHTxProvider } from '../eth';
import { ERC20Abi } from './abi';
import { factoryABI } from './factory';
import { exchangeABI } from './uniswap';

export class ERC20TxProvider extends ETHTxProvider {

  getERC20Contract(tokenContractAddress: string) {
    const web3 = new Web3();
    const contract = new web3.eth.Contract(ERC20Abi, tokenContractAddress);
    return contract;
  }

  getUniSwapExchange(tokenContractAddress) {
    const web3 = new Web3();
    const contract = new web3.eth.Contract(exchangeABI, tokenContractAddress);
    return contract;
  }

  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    nonce: number;
    gasPrice: number;
    data: string;
    gasLimit: number;
    tokenAddress: string;
    network: string;
    chainId?: number;
  }) {
    const { tokenAddress } = params;
    const data = this.encodeData(params);
    const recipients = [{ address: tokenAddress, amount: '0' }];
    const newParams = { ...params, recipients, data };
    return super.create(newParams);
  }

  encodeData(params: {
    recipients: Array<{ address: string; amount: string }>;
    tokenAddress: string;
  }) {
    const { tokenAddress } = params;
    const [{ address, amount }] = params.recipients;
    const amountStr = Number(amount).toLocaleString('en', {useGrouping: false});
    const data = this.getERC20Contract(tokenAddress)
      .methods.transfer(address, amountStr)
      .encodeABI();
    return data;
  }

  getExchange() {
    return '0x613639E23E91fd54d50eAfd6925AF2Ed6701A46b';
  }

  getDeadline() {
    return Date.now() + 300;
  }
  swapETHToDai(amount) {
    const deadline = this.getDeadline();
    const amountStr = Number(amount).toLocaleString('en', {useGrouping: false});
    const data = this.getUniSwapExchange(this.getExchange())
      .methods.ethToTokenSwapOutput(amountStr, deadline).encodeABI();
    return data;
  }

  swapBackToETH(params: {

  }) {

  }

}
