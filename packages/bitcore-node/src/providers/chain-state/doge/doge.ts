import { BTCStateProvider } from '../btc/btc';

export class DOGEStateProvider extends BTCStateProvider {
  constructor(chain: string = 'DOGE') {
    super(chain);
  }
}
