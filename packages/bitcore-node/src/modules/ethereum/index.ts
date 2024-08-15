import { BaseModule } from '..';
import { EVMVerificationPeer } from '../,,/../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { IEVMNetworkConfig } from '../../types/Config';
import { ETHStateProvider } from './api/csp';
import { EthRoutes } from './api/eth-routes';
import { EthP2pWorker } from './p2p/p2p';

export default class ETHModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IEVMNetworkConfig) {
    super(services);
    services.P2P.register(chain, network, EthP2pWorker);
    services.CSP.registerService(chain, network, new ETHStateProvider());
    services.Api.app.use(EthRoutes);
    services.Verification.register(chain, network, EVMVerificationPeer);
  }
}
