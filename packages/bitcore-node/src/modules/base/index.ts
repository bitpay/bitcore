import { BaseModule } from '..';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { IEVMNetworkConfig } from '../../types/Config';
import { BaseRoutes } from './api/base-routes';
import { BASEStateProvider } from './api/csp';
import { getBaseP2pWorker } from './p2p/p2p';

export default class BASEModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], network: string, _config: IEVMNetworkConfig) {
    super(services);
    services.P2P.register('BASE', network, getBaseP2pWorker(_config));
    services.CSP.registerService('BASE', network, new BASEStateProvider());
    services.Api.app.use(BaseRoutes);
    services.Verification.register('BASE', network, EVMVerificationPeer);
  }
}
