const abi = require('./erc20abi');
const Web3 = require('web3-eth');
const config = require('../../../config');
const mongoose = require('mongoose');
const Wallet = mongoose.model('Wallet');
const Storage = require('../../../services/storage');
const WalletAddress = mongoose.model('WalletAddress');

import { CSP } from "../../../types/namespaces/ChainStateProvider";
import { ETHStateProvider } from "../eth/eth";

export class ERC20StateProvider extends ETHStateProvider implements CSP.IChainStateService {
  contractAddr: string;

  constructor(chain: string, contractAddr: string) {
    super(chain);
    this.contractAddr = contractAddr;
  }

  erc20For(network: string) {
    const web3 = this.getRPC(network);
    const contract = new web3.Contract(abi, this.contractAddr);
    return contract;
  };

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { network, address } = params;
     const balance = await this.erc20For(network)
      .methods.balanceOf(address)
      .call();
    return [{ balance }];
  };
}
