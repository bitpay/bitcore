import { BaseModule } from '..';
import { WCNStateProvider } from '../../providers/chain-state/wcn/wcn';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { WidecoinP2PWorker } from './p2p';

export default class WCNModule extends BaseModule {
  constructor(services) {
    super(services);
    services.Libs.register('WCN', 'bitcore-lib-wcn', 'bitcore-p2p-wcn');
    services.P2P.register('WCN', WidecoinP2PWorker);
    services.CSP.registerService('WCN', new WCNStateProvider());
    services.Verification.register('WCN', VerificationPeer);
  }
}
