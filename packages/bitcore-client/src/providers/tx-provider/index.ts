import { BTCTxProvider } from './btc';
import { BCHTxProvider } from './bch';
import { ETHTxProvider } from './eth';

const providers = {
  BTC: new BTCTxProvider(),
  BCH: new BCHTxProvider(),
  ETH: new ETHTxProvider()
};

export class TxProvider {
  get({ chain }) {
    return providers[chain];
  }

  create(params) {
    return this.get(params).create(params);
  }

  // WIP: Needs typings - Eth returns Promise<Uint8Array> while BTC returns Promise<string>
  async sign(params): Promise<any> {
    return this.get(params).sign(params);
  }

  getSigningAddresses(params) {
    return this.get(params).getSigningAddresses(params);
  }
}

export default new TxProvider();
