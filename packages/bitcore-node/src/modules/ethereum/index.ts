import { ChainStateProvider } from '../../providers/chain-state';
import { EVMVerificationPeer } from '../../providers/chain-state/evm/p2p/EVMVerificationPeer';
import { Api } from '../../services/api';
import { P2P } from '../../services/p2p';
import { Verification } from '../../services/verification';
import { RegisterModule } from '../../types/Module';
import { ETHStateProvider } from './api/csp';
import { EthRoutes } from './api/eth-routes';
import { EthP2pWorker } from './p2p/p2p';

const registerModule: RegisterModule = ({ chain, network }) => {
  P2P.register(chain, network, EthP2pWorker);
  ChainStateProvider.registerService(chain, network, new ETHStateProvider());
  Api.app.use(EthRoutes);
  Verification.register(chain, network, EVMVerificationPeer);
};

export default registerModule;
