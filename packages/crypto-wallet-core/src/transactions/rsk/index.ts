import { ETHTxProvider } from '../eth';

// Reuse ETHTxProvider for RSK and override the required methods
export class RSKTxProvider extends ETHTxProvider {

  // Overridden getChainId for RSK 
  getChainId(network: string) {
    let chainId = 137;
    switch (network) {
      case 'testnet':
        chainId = 37310;
        break;
      case 'regtest':
        chainId = 37310;
        break;
      default:
        chainId = 137;
        break;
    }

    return chainId;
  }
}
