import { EVMRouter } from '../../../providers/chain-state/evm/api/routes';
import { OP } from './csp';

class OPRouter extends EVMRouter {
  constructor() {
    super(OP, 'OP');
  }
}

export const OpRoutes =  new OPRouter().getRouter();