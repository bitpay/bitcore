import { BaseModule } from '..';
import { DOGEStateProvider } from '../../providers/chain-state/doge/doge';
import { IUtxoNetworkConfig } from '../../types/Config';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { DogecoinP2PWorker } from './p2p';

export default class DOGEModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IUtxoNetworkConfig) {
    super(services);
    services.Libs.register(chain, '@bitpay-labs/bitcore-lib-doge', '@bitpay-labs/bitcore-p2p-doge');
    services.P2P.register(chain, network, DogecoinP2PWorker);
    services.CSP.registerService(chain, network, new DOGEStateProvider());
    services.Verification.register(chain, network, VerificationPeer);
  }
}
