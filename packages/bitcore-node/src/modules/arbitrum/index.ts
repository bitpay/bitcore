import { BaseModule } from '..';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { ArbRoutes } from './api/arb-routes';
// import { EVMESWorker } from '../../providers/chain-state/evm/es/es';
import { ARBStateProvider } from './api/csp';

export default class ARBModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    // services.ES.register('ARB', EVMESWorker);
    services.CSP.registerService('ARB', new ARBStateProvider());
    services.Api.app.use(ArbRoutes);
    services.Verification.register('ARB', EVMVerificationPeer);
  }
}