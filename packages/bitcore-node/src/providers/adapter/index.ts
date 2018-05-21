import { Chain } from '../../types/ChainNetwork';
import { Adapter } from '../../types/namespaces/ChainAdapter';
import { BTCAdapter } from './btc/BtcAdapter';
import { BCHAdapter } from './bch/BchAdapter';

type ChainAdapters = {
  [key: string]: Adapter.IChainAdapter<any, any>;
};
const adapters: ChainAdapters = {
  BTC: new BTCAdapter(),
  BCH: new BCHAdapter()
};
export class AdapterProxy {
  get({ chain }: Chain) {
    return adapters[chain];
  }
  convertBlock<B>(params: Adapter.ConvertBlockParams<B>) {
    return this.get(params).convertBlock(params);
  }
  convertTx<T, B>(params: Adapter.ConvertTxParams<T, B>) {
    return this.get(params).convertTx(params);
  }
}

export let AdapterProvider = new AdapterProxy();
