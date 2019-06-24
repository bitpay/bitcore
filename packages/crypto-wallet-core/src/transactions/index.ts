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

  async sign(params): Promise<any> {
    return this.get(params).sign(params);
  }
}

export default new TxProvider();
