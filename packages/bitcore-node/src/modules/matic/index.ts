import { BaseModule } from '..';
import { EVMRoutes } from '../../providers/chain-state/evm/api/routes';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { EVMP2pWorker } from '../../providers/chain-state/evm/p2p/p2p';
import { MATICStateProvider } from './api/csp';

export default class MATICModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    services.P2P.register('MATIC', EVMP2pWorker);
    services.CSP.registerService('MATIC', new MATICStateProvider());
    services.Api.app.use(EVMRoutes);
    services.Verification.register('MATIC', EVMVerificationPeer);
  }
}
