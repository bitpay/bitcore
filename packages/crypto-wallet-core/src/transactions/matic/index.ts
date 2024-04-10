import { ETHTxProvider } from '../eth';

export class MATICTxProvider extends ETHTxProvider {
  getChainId(network: string) {
    let chainId = 137;
    switch (network) {
      case 'testnet':
      case 'mumbai':
        chainId = 80001;
        break;
      case 'regtest':
        chainId = 13375;
        break;
      default:
        chainId = 137;
        break;
    }
    return chainId;
  }
}
