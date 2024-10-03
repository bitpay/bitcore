import { EVMRouter } from '../../../providers/chain-state/evm/api/routes';
import { MATIC } from './csp';

class MATICRouter extends EVMRouter {
  constructor() {
    super(MATIC, 'MATIC', { multisig: true });
  }
}
export const MaticRoutes = new MATICRouter().getRouter();