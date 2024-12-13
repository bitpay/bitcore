import { SVMRouter } from '../../../providers/chain-state/svm/api/routes';
import { SOL } from './csp';

class SOLRouter extends SVMRouter {
  constructor() {
    super(SOL, 'SOL');
  }
}
export const SOLRoutes = new SOLRouter().getRouter();