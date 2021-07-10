import { BaseModule } from '..';
import { XPIStateProvider } from '../../providers/chain-state/xpi/xpi';
import { BitcoinP2PWorker } from '../bitcoin/p2p';
import { VerificationPeer } from '../bitcoin/VerificationPeer';

export default class XPIModule extends BaseModule {
  constructor(services) {
    super(services);
    services.Libs.register('XPI', '@abcpros/bitcore-lib-xpi', 'bitcore-p2p-xpi');
    services.P2P.register('XPI', BitcoinP2PWorker);
    services.CSP.registerService('XPI', new XPIStateProvider());
    services.Verification.register('XPI', VerificationPeer);
  }
}
