import { BaseModule } from '..';
import { RSKStateProvider } from './api/csp';
import { RskRoutes } from './api/rsk-routes';
import { RskVerificationPeer } from './p2p/RskVerificationPeer';
import { RskP2pWorker } from './p2p/p2p';

export default class RSKModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    services.P2P.register('RSK', RskP2pWorker);
    services.CSP.registerService('RSK', new RSKStateProvider());
    services.Api.app.use(RskRoutes);
    services.Verification.register('RSK', RskVerificationPeer);
  }
}
