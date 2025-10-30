import { BaseModule } from '..';
import { BCHStateProvider } from '../../providers/chain-state/bch/bch';
import { IUtxoNetworkConfig } from '../../types/Config';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { BitcoinP2PWorker } from '../bitcoin/p2p';

export default class BCHModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register(chain, 'bitcore-lib-cash', 'bitcore-p2p-cash');
    services.P2P.register(chain, network, BitcoinP2PWorker);
    services.CSP.registerService(chain, network, new BCHStateProvider());
    services.Verification.register(chain, network, VerificationPeer);
  }
}
