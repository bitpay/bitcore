const abi = require('./erc20abi');

import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { ETHStateProvider } from '../eth/eth';
import { EventStorage } from '../../../models/events';

export class ERC20StateProvider extends ETHStateProvider implements CSP.IChainStateService {
  contractAddr: string;

  constructor(chain: string, contractAddr: string) {
    super(chain);
    this.contractAddr = contractAddr;
  }

  erc20For(network: string) {
    const web3 = this.getWeb3(network);
    const contract = new web3.eth.Contract(abi, this.contractAddr);
    return contract;
  }

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { network, address } = params;
    const balance = await this.erc20For(network)
      .methods.balanceOf(address)
      .call();
    return { confirmed: balance, unconfirmed: 0, balance };
  }

  watchTokenTransfers(network: string) {
    const tokenContract = this.erc20For(network);

    tokenContract.events.Transfer(async (error, event) => {
      if (error) {
        console.log(error);
        return;
      }
      await EventStorage.signalTx(event.transactionHash);

      console.log('Transaction hash is: ' + event.transactionHash + '\n');
      return;
    });
  }
}
