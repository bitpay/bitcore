import { BaseModule } from '..';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
// import { EVMESWorker } from '../../providers/chain-state/evm/es/es';
import { SOLStateProvider } from './api/csp';
import { SOLRoutes } from './api/sol-routes';

export default class SOLModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    // services.ES.register('OP', EVMESWorker);
    services.CSP.registerService('SOL', new SOLStateProvider());
    services.Api.app.use(SOLRoutes);
    services.Verification.register('SOL', EVMVerificationPeer);
  }
}