import { BaseModule } from '..';
import { LTCStateProvider } from '../../providers/chain-state/ltc/ltc';
import { IUtxoNetworkConfig } from '../../types/Config';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { LitecoinP2PWorker } from './p2p';

export default class LTCModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register('LTC', 'bitcore-lib-ltc', 'bitcore-p2p');
    services.P2P.register('LTC', network, LitecoinP2PWorker);
    services.CSP.registerService('LTC', network, new LTCStateProvider());
    services.Verification.register('LTC', network, VerificationPeer);
  }
}
