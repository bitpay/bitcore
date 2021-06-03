import { BaseModule } from '..';
import { LTCStateProvider } from '../../providers/chain-state/ltc/ltc';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { LitecoinP2PWorker } from './p2p';

export default class LTCModule extends BaseModule {
  constructor(services) {
    super(services);
    services.Libs.register('LTC', 'bitcore-lib-ltc', 'bitcore-p2p');
    services.P2P.register('LTC', LitecoinP2PWorker);
    services.CSP.registerService('LTC', new LTCStateProvider());
    services.Verification.register('LTC', VerificationPeer);
  }
}
