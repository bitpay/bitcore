import { BaseModule } from '..';
import { LotusStateProvider } from '../../providers/chain-state/lotus/lotus';
import { BitcoinP2PWorker } from '../bitcoin/p2p';
import { VerificationPeer } from '../bitcoin/VerificationPeer';

export default class LotusModule extends BaseModule {
  constructor(services) {
    super(services);
    services.Libs.register('LOTUS', 'bitcore-lib-cash', 'bitcore-p2p-lotus');
    services.P2P.register('LOTUS', BitcoinP2PWorker);
    services.CSP.registerService('LOTUS', new LotusStateProvider());
    services.Verification.register('LOTUS', VerificationPeer);
  }
}
