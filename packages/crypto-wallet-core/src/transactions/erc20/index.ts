import Web3 from 'web3';
import { ETHTxProvider } from '../eth';
import { ERC20Abi } from './abi';
export class ERC20TxProvider extends ETHTxProvider {
  getERC20Contract(tokenContractAddress) {
    const web3 = new Web3();
    const contract = new web3.eth.Contract(ERC20Abi, tokenContractAddress);
    return contract;
  }

  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    from: string;
    nonce: number;
    gasPrice: number;
    data: string;
    gasLimit: number;
    tokenAddress: string;
  }) {
    const { tokenAddress } = params;
    const [{ address, amount }] = params.recipients;
    const data = this.getERC20Contract(tokenAddress)
      .methods.transfer(address, amount)
      .encodeABI();
    const recipients = [{ address: tokenAddress, amount: '0' }];
    const newParams = { ...params, recipients, data };
    return super.create(newParams);
  }
}
