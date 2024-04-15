import { EVMRouter } from '../../ethereum/api/evmRouter';
import { ARB } from './csp';

class ARBRouter extends EVMRouter {
  constructor() {
    super(ARB, 'ARB');
  }
}

export const ArbRoutes =  new ARBRouter().getRouter();