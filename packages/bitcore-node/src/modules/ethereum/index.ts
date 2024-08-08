import { BaseModule } from '..';
import { EVMVerificationPeer } from '../,,/../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { IEVMNetworkConfig } from '../../types/Config';
import { ETHStateProvider } from './api/csp';
import { EthRoutes } from './api/eth-routes';
import { getEthP2pWorker } from './p2p/p2p';

export default class ETHModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], network: string, _config: IEVMNetworkConfig) {
    super(services);
    services.P2P.register('ETH', network, getEthP2pWorker(_config));
    services.CSP.registerService('ETH', network, new ETHStateProvider());
    services.Api.app.use(EthRoutes);
    services.Verification.register('ETH', network, EVMVerificationPeer);
  }
}
