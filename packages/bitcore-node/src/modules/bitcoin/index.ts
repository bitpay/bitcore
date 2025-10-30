import { BaseModule } from '..';
import { BTCStateProvider } from '../../providers/chain-state/btc/btc';
import { IUtxoNetworkConfig } from '../../types/Config';
import { VerificationPeer } from './VerificationPeer';
import { BitcoinP2PWorker } from './p2p';

export default class BitcoinModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register(chain, 'bitcore-lib', 'bitcore-p2p');
    services.P2P.register(chain, network, BitcoinP2PWorker);
    services.CSP.registerService(chain, network, new BTCStateProvider());
    services.Verification.register(chain, network, VerificationPeer);
  }
}
