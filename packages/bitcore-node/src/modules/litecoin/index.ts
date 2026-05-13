import { ChainStateProvider } from '../../providers/chain-state';
import { LTCStateProvider } from '../../providers/chain-state/ltc/ltc';
import { Libs } from '../../providers/libs';
import { P2P } from '../../services/p2p';
import { Verification } from '../../services/verification';
import { RegisterModule } from '../../types/Module';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { LitecoinP2PWorker } from './p2p';

const registerModule: RegisterModule = ({ chain, network }) => {
  Libs.register(chain, '@bitpay-labs/bitcore-lib-ltc', '@bitpay-labs/bitcore-p2p');
  P2P.register(chain, network, LitecoinP2PWorker);
  ChainStateProvider.registerService(chain, network, new LTCStateProvider());
  Verification.register(chain, network, VerificationPeer);
};

export default registerModule;
