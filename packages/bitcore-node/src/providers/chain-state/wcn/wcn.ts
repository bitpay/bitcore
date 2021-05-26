import { BTCStateProvider } from '../btc/btc';

export class WCNStateProvider extends BTCStateProvider {
  constructor(chain: string = 'WCN') {
    super(chain);
  }
}
