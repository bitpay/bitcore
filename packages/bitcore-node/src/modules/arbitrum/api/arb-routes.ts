import { EVMRouter } from '../../../providers/chain-state/evm/api/routes';
import { ARB } from './csp';

class ARBRouter extends EVMRouter {
  constructor() {
    super(ARB, 'ARB');
  }
}

export const ArbRoutes =  new ARBRouter().getRouter();