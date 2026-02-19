import { BaseModule } from '..';
import { EVMRouter } from '../../providers/chain-state/evm/api/routes';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { IEVMNetworkConfig } from '../../types/Config';
import { MoralisP2PWorker } from '../moralis/p2p/p2p';
import { MultiProviderEVMStateProvider } from './api/csp';

export default class MultiProviderModule extends BaseModule {
  constructor(
    services: BaseModule['bitcoreServices'],
    chain: string,
    network: string,
    _config: IEVMNetworkConfig
  ) {
    super(services);

    // Reuse MoralisP2PWorker for now (handles webhook sync).
    // When Alchemy webhooks are added, this can be replaced with a
    // multi-provider P2P worker.
    services.P2P.register(chain, network, MoralisP2PWorker);

    const csp = new MultiProviderEVMStateProvider(chain);
    services.CSP.registerService(chain, network, csp);
    services.Api.app.use(new EVMRouter(csp, chain).getRouter());
    services.Verification.register(chain, network, EVMVerificationPeer);
  }
}
