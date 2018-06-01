import { Chain } from '../../types/ChainNetwork';
import { IChainAdapter } from '../../types/namespaces/ChainAdapter';
import { BTCAdapter } from './btc/BtcAdapter';
import { BCHAdapter } from './bch/BchAdapter';


export class AdapterProxy {
  private adapters: {
    [key: string]: IChainAdapter<any, any>;
  } = {
    BTC: new BTCAdapter(),
    BCH: new BCHAdapter(),
  };

  get({ chain }: Chain) {
    return this.adapters[chain];
  }
}

export let AdapterProvider = new AdapterProxy();
