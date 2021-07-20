import { BaseModule } from '..';
import { XECStateProvider } from '../../providers/chain-state/xec/xec';
import { BitcoinP2PWorker } from '../bitcoin/p2p';
import { VerificationPeer } from '../bitcoin/VerificationPeer';

export default class XECModule extends BaseModule {
  constructor(services) {
    super(services);
    services.Libs.register('XEC', '@abcpros/bitcore-lib-xec', 'bitcore-p2p-xec');
    services.P2P.register('XEC', BitcoinP2PWorker);
    services.CSP.registerService('XEC', new XECStateProvider());
    services.Verification.register('XEC', VerificationPeer);
  }
}
