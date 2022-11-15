import { ethers } from 'ethers';
import Web3 from 'web3';
import { ETHTxProvider } from '../eth';
const utils = require('web3-utils');
const { toBN } = Web3.utils;
export class MATICTxProvider extends ETHTxProvider {
  getChainId(network: string) {
    let chainId = 137;
    switch (network) {
      case 'testnet':
      case 'mumbai':
        chainId = 80001;
        break;
      case 'regtest':
        chainId = 1337;
        break;
      default:
        chainId = 137;
        break;
    }
    return chainId;
  }
}
