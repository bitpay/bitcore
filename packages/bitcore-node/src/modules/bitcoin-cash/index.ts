import { ChainStateProvider } from '../../providers/chain-state';
import { BCHStateProvider } from '../../providers/chain-state/bch/bch';
import { Libs } from '../../providers/libs';
import { P2P } from '../../services/p2p';
import { Verification } from '../../services/verification';
import { RegisterModule } from '../../types/Module';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { BitcoinP2PWorker } from '../bitcoin/p2p';

const registerModule: RegisterModule = ({ chain, network }) => {
  Libs.register(chain, '@bitpay-labs/bitcore-lib-cash', '@bitpay-labs/bitcore-p2p-cash');
  P2P.register(chain, network, BitcoinP2PWorker);
  ChainStateProvider.registerService(chain, network, new BCHStateProvider());
  Verification.register(chain, network, VerificationPeer);
};

export default registerModule;
