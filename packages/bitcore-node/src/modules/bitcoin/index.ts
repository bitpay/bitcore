import { ChainStateProvider } from '../../providers/chain-state';
import { BTCStateProvider } from '../../providers/chain-state/btc/btc';
import { Libs } from '../../providers/libs';
import { P2P } from '../../services/p2p';
import { Verification } from '../../services/verification';
import { RegisterModule } from '../../types/Module';
import { VerificationPeer } from './VerificationPeer';
import { BitcoinP2PWorker } from './p2p';

const registerModule: RegisterModule = ({ chain, network }) => {
  Libs.register(chain, '@bitpay-labs/bitcore-lib', '@bitpay-labs/bitcore-p2p');
  P2P.register(chain, network, BitcoinP2PWorker);
  ChainStateProvider.registerService(chain, network, new BTCStateProvider());
  Verification.register(chain, network, VerificationPeer);
};

export default registerModule;
