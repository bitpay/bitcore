import { ChainStateProvider } from '../../providers/chain-state';
import { EVMRouter } from '../../providers/chain-state/evm/api/routes';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { Api } from '../../services/api';
import { P2P } from '../../services/p2p';
import { Verification } from '../../services/verification';
import { RegisterModule } from '../../types/Module';
import { MoralisP2PWorker } from '../moralis/p2p/p2p';
import { MultiProviderEVMStateProvider } from './api/csp';

const registerModule: RegisterModule = ({ chain, network }) => {
  // Reuse MoralisP2PWorker for now (handles webhook sync).
  // When Alchemy webhooks are added, this can be replaced with a
  // multi-provider P2P worker.
  P2P.register(chain, network, MoralisP2PWorker);
  const csp = new MultiProviderEVMStateProvider(chain);
  ChainStateProvider.registerService(chain, network, csp);
  Api.app.use(new EVMRouter(csp, chain).getRouter());
  Verification.register(chain, network, EVMVerificationPeer);
};

export default registerModule;
