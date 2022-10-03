import { BaseModule } from '..';
import { MATICStateProvider } from './api/csp';
import { MaticRoutes } from './api/matic-routes';
import { MaticVerificationPeer } from './p2p/MaticVerificationPeer';
import { MaticP2pWorker } from './p2p/p2p';

export default class MATICModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    services.P2P.register('MATIC', MaticP2pWorker);
    services.CSP.registerService('MATIC', new MATICStateProvider());
    services.Api.app.use(MaticRoutes);
    services.Verification.register('MATIC', MaticVerificationPeer);
  }
}
