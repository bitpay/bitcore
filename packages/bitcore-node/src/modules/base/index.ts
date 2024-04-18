import { BaseModule } from '..';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { BaseRoutes } from './api/base-routes';
// import { EVMESWorker } from '../../providers/chain-state/evm/es/es';
import { BASEStateProvider } from './api/csp';

export default class BASEModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    // services.ES.register('BASE', EVMESWorker);
    services.CSP.registerService('BASE', new BASEStateProvider());
    services.Api.app.use(BaseRoutes);
    services.Verification.register('BASE', EVMVerificationPeer);
  }
}
