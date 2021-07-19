import { BaseModule } from '..';
import { BCHAStateProvider } from '../../providers/chain-state/bcha/bcha';
import { BitcoinP2PWorker } from '../bitcoin/p2p';
import { VerificationPeer } from '../bitcoin/VerificationPeer';

export default class BCHAModule extends BaseModule {
  constructor(services) {
    super(services);
    services.Libs.register('BCHA', '@abcpros/bitcore-lib-cash', 'bitcore-p2p-bcha');
    services.P2P.register('BCHA', BitcoinP2PWorker);
    services.CSP.registerService('BCHA', new BCHAStateProvider());
    services.Verification.register('BCHA', VerificationPeer);
  }
}
