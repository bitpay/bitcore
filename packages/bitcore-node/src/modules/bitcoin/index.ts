import { BaseModule } from '..';
import { BTCStateProvider } from '../../providers/chain-state/btc/btc';
import { IUtxoNetworkConfig } from '../../types/Config';
import { BitcoinP2PWorker } from './p2p';
import { VerificationPeer } from './VerificationPeer';

export default class BitcoinModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register('BTC', 'bitcore-lib', 'bitcore-p2p');
    services.P2P.register('BTC', network, BitcoinP2PWorker);
    services.CSP.registerService('BTC', network, new BTCStateProvider());
    services.Verification.register('BTC', network, VerificationPeer);
  }
}
