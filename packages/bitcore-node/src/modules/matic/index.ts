import { BaseModule } from '..';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { EVMP2pWorker } from '../../providers/chain-state/evm/p2p/p2p';
import { IEVMNetworkConfig } from '../../types/Config';
import { MATICStateProvider } from './api/csp';
import { MaticRoutes } from './api/matic-routes';

export default class MATICModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IEVMNetworkConfig) {
    super(services);
    services.P2P.register(chain, network, EVMP2pWorker);
    services.CSP.registerService(chain, network, new MATICStateProvider());
    services.Api.app.use(MaticRoutes);
    services.Verification.register(chain, network, EVMVerificationPeer);
  }
}
