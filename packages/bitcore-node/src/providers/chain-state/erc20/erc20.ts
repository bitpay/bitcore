const abi = require('./erc20abi');

import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { ETHStateProvider } from '../eth/eth';

export class ERC20StateProvider extends ETHStateProvider
  implements CSP.IChainStateService {
  contractAddr: string;

  constructor(chain: string, contractAddr: string) {
    super(chain);
    this.contractAddr = contractAddr;
  }

  erc20For(network: string) {
    const web3 = this.getRPC(network);
    const contract = new web3.Contract(abi, this.contractAddr);
    return contract;
  }

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { network, address } = params;
    const balance: number = await this.erc20For(network)
      .methods.balanceOf(address)
      .call();
    return [{ balance }];
  };
}
