import { BaseModule } from '..';
import { EVMRouter } from '../../providers/chain-state/evm/api/routes';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { IEVMNetworkConfig } from '../../types/Config';
import { MoralisStateProvider } from './api/csp';
import { MoralisP2PWorker } from './p2p/p2p';

export default class MoralisModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IEVMNetworkConfig) {
    super(services);
    services.P2P.register(chain, network, MoralisP2PWorker);
    const csp = new MoralisStateProvider(chain);
    services.CSP.registerService(chain, network, csp);
    services.Api.app.use(new EVMRouter(csp, chain).getRouter());
    services.Verification.register(chain, network, EVMVerificationPeer);
  }
}