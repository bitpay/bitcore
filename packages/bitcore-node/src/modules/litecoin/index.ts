import { BaseModule } from '..';
import { LTCStateProvider } from '../../providers/chain-state/ltc/ltc';
import { LitecoinP2PWorker } from './p2p';
import { VerificationPeer } from './VerificationPeer';

export default class LitecoinModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    services.Libs.register('LTC', 'litecore-lib', 'litecore-p2p');
    services.P2P.register('LTC', LitecoinP2PWorker);
    services.CSP.registerService('LTC', new LTCStateProvider());
    services.Verification.register('LTC', VerificationPeer);
  }
}
