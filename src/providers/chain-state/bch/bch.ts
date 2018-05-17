import { BTCStateProvider }  from '../btc/btc';

export class BCHStateProvider extends BTCStateProvider {
  constructor(chain: string = 'BCH') {
    super(chain);
  }
}
