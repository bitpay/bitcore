import { BaseModule } from '..';
import { DOGEStateProvider } from '../../providers/chain-state/doge/doge';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { DogecoinP2PWorker } from './p2p';

export default class DOGEModule extends BaseModule {
  constructor(services) {
    super(services);
    services.Libs.register('DOGE', 'bitcore-lib-doge', 'bitcore-p2p-doge');
    services.P2P.register('DOGE', DogecoinP2PWorker);
    services.CSP.registerService('DOGE', new DOGEStateProvider());
    services.Verification.register('DOGE', VerificationPeer);
  }
}
