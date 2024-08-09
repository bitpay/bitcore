import { BaseModule } from '..';
import { DOGEStateProvider } from '../../providers/chain-state/doge/doge';
import { IUtxoNetworkConfig } from '../../types/Config';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { DogecoinP2PWorker } from './p2p';

export default class DOGEModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register('DOGE', 'bitcore-lib-doge', 'bitcore-p2p-doge');
    services.P2P.register('DOGE', network, DogecoinP2PWorker);
    services.CSP.registerService('DOGE', network, new DOGEStateProvider());
    services.Verification.register('DOGE', network, VerificationPeer);
  }
}
