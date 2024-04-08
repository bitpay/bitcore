import { EVMRouter } from '../../ethereum/api/evmRouter';
import { OP } from './csp';

class OPRouter extends EVMRouter {
  constructor() {
    super(OP, 'OP');
  }
}

export const OpRoutes =  new OPRouter().getRouter();