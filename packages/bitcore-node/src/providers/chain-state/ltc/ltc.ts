import { BTCStateProvider } from '../btc/btc';

export class LTCStateProvider extends BTCStateProvider {
  constructor(chain: string = 'LTC') {
    super(chain);
  }
}
