import { BaseModule } from '..';
import { XPIStateProvider } from '../../providers/chain-state/xpi/xpi';
import { IUtxoNetworkConfig } from '../../types/Config';
import { BitcoinP2PWorker } from '../bitcoin/p2p';
import { VerificationPeer } from '../bitcoin/VerificationPeer';

export default class XPIModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register(chain, '@bcpros/bitcore-lib-xpi', '@bcpros/bitcore-p2p-xpi');
    services.P2P.register(chain, network, BitcoinP2PWorker);
    services.CSP.registerService(chain, network, new XPIStateProvider());
    services.Verification.register(chain, network, VerificationPeer);
  }
}
