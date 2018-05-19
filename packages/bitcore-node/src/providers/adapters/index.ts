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
  static get({ chain }: Chain) {
    return adapters[chain];
  }
  static convertBlock<T>(params: Adapter.ConvertBlockParams<T>) {
    return AdapterProxy.get(params).convertBlock(params);
  }
}
