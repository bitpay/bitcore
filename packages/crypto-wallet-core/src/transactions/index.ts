import { BTCTxProvider } from './btc';
import { BCHTxProvider } from './bch';
import { ETHTxProvider } from './eth';
import { ERC20TxProvider } from './erc20';

const providers = {
  BTC: new BTCTxProvider(),
  BCH: new BCHTxProvider(),
  ETH: new ETHTxProvider(),
  ERC20: new ERC20TxProvider()
};

export class TransactionsProxy {
  get({ chain }) {
    return providers[chain];
  }

  create(params) {
    return this.get(params).create(params);
  }

  sign(params): string {
    return this.get(params).sign(params);
  }
}

export default new TransactionsProxy();
