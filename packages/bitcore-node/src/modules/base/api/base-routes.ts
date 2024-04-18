import { EVMRouter } from '../../ethereum/api/evmRouter';
import { BASE } from './csp';

const chain = 'BASE';

class BASERouter extends EVMRouter {
  constructor() {
    super(BASE, chain);
  }
}
const router = new BASERouter().getRouter();

export const BaseRoutes = router;