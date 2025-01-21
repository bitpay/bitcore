import { BaseModule } from '..';
import { XECStateProvider } from '../../providers/chain-state/xec/xec';
import { IUtxoNetworkConfig } from '../../types/Config';
import { BitcoinP2PWorker } from '../bitcoin/p2p';
import { VerificationPeer } from '../bitcoin/VerificationPeer';

export default class XECModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register(chain, '@bcpros/bitcore-lib-xec', '@bcpros/bitcore-p2p-xec');
    services.P2P.register(chain, network, BitcoinP2PWorker);
    services.CSP.registerService(chain, network, new XECStateProvider());
    services.Verification.register(chain, network, VerificationPeer);
  }
}
