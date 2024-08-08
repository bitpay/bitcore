import { BaseModule } from '..';
import { BCHStateProvider } from '../../providers/chain-state/bch/bch';
import { IUtxoNetworkConfig } from '../../types/Config';
import { BitcoinP2PWorker } from '../bitcoin/p2p';
import { VerificationPeer } from '../bitcoin/VerificationPeer';

export default class BCHModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register('BCH', 'bitcore-lib-cash', 'bitcore-p2p-cash');
    services.P2P.register('BCH', network, BitcoinP2PWorker);
    services.CSP.registerService('BCH', network, new BCHStateProvider());
    services.Verification.register('BCH', network, VerificationPeer);
  }
}
