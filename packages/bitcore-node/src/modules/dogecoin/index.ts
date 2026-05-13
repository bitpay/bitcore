import { ChainStateProvider } from '../../providers/chain-state';
import { DOGEStateProvider } from '../../providers/chain-state/doge/doge';
import { Libs } from '../../providers/libs';
import { P2P } from '../../services/p2p';
import { Verification } from '../../services/verification';
import { RegisterModule } from '../../types/Module';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { DogecoinP2PWorker } from './p2p';

const registerModule: RegisterModule = ({ chain, network }) => {
  Libs.register(chain, '@bitpay-labs/bitcore-lib-doge', '@bitpay-labs/bitcore-p2p-doge');
  P2P.register(chain, network, DogecoinP2PWorker);
  ChainStateProvider.registerService(chain, network, new DOGEStateProvider());
  Verification.register(chain, network, VerificationPeer);
};

export default registerModule;
