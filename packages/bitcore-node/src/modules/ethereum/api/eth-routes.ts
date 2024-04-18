import { EVMRouter } from '../../ethereum/api/evmRouter';
import { ETH } from './csp';

class ETHRouter extends EVMRouter {
  constructor() {
    super(ETH, 'ETH', { multisig: true });
  }
}
export const EthRoutes = new ETHRouter().getRouter();