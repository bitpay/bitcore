import { BaseModule } from '..';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { IEVMNetworkConfig } from '../../types/Config';
import { ArbRoutes } from './api/arb-routes';
import { ARBStateProvider } from './api/csp';
import { getArbP2pWorker } from './p2p/p2p';

export default class ARBModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], network: string, _config: IEVMNetworkConfig) {
    super(services);
    services.P2P.register('ARB', network, getArbP2pWorker(_config));
    services.CSP.registerService('ARB', network, new ARBStateProvider());
    services.Api.app.use(ArbRoutes);
    services.Verification.register('ARB', network, EVMVerificationPeer);
  }
}