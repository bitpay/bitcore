import { EVMRouter } from '../../../providers/chain-state/evm/api/routes';
import { BASE } from './csp';

class BASERouter extends EVMRouter {
  constructor() {
    super(BASE, 'BASE');
  }
}

export const BaseRoutes = new BASERouter().getRouter();;