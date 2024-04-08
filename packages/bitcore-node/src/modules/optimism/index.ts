import { BaseModule } from '..';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
// import { EVMESWorker } from '../../providers/chain-state/evm/es/es';
import { OPStateProvider } from './api/csp';
import { OpRoutes } from './api/op-routes';

export default class OPModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    // services.ES.register('OP', EVMESWorker);
    services.CSP.registerService('OP', new OPStateProvider());
    services.Api.app.use(OpRoutes);
    services.Verification.register('OP', EVMVerificationPeer);
  }
}