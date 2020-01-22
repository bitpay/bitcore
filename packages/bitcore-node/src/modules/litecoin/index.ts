import { BitcoinP2PWorker } from '../bitcoin/p2p';
import { BaseModule } from '..';
import { LTCStateProvider } from '../../providers/chain-state/ltc/ltc';
import { VerificationPeer } from '../bitcoin/VerificationPeer';

export default class LTCModule extends BaseModule {
  constructor(services) {
    super(services);
    services.Libs.register('LTC', 'litecore-lib', 'litecore-p2p');
    services.P2P.register('LTC', BitcoinP2PWorker);
    services.CSP.registerService('LTC', new LTCStateProvider());
    services.Verification.register('LTC', VerificationPeer);
  }
}
