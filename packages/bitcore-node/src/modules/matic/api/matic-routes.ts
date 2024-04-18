import { EVMRouter } from '../../ethereum/api/evmRouter';
import { MATIC } from './csp';

class MATICRouter extends EVMRouter {
  constructor() {
    super(MATIC, 'MATIC', { multisig: true });
  }
}
export const MaticRoutes = new MATICRouter().getRouter();