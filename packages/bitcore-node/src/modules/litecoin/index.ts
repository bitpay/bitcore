import { BaseModule } from '..';
import { LTCStateProvider } from '../../providers/chain-state/ltc/ltc';
import { IUtxoNetworkConfig } from '../../types/Config';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { LitecoinP2PWorker } from './p2p';

export default class LTCModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register(chain, '@bitpay-labs/bitcore-lib-ltc', '@bitpay-labs/bitcore-p2p');
    services.P2P.register(chain, network, LitecoinP2PWorker);
    services.CSP.registerService(chain, network, new LTCStateProvider());
    services.Verification.register(chain, network, VerificationPeer);
  }
}
