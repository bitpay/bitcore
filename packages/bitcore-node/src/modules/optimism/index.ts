import { BaseModule } from '..';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { IEVMNetworkConfig } from '../../types/Config';
import { OPStateProvider } from './api/csp';
import { OpRoutes } from './api/op-routes';
import { getOpP2pWorker } from './p2p/p2p';

export default class OPModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], network: string, _config: IEVMNetworkConfig) {
    super(services);
    services.P2P.register('OP', network, getOpP2pWorker(_config));
    services.CSP.registerService('OP', network, new OPStateProvider());
    services.Api.app.use(OpRoutes);
    services.Verification.register('OP', network, EVMVerificationPeer);
  }
}