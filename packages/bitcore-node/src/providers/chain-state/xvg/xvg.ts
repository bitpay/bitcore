import { BTCStateProvider } from '../btc/btc';

export class XVGStateProvider extends BTCStateProvider {
  constructor(chain: string = 'XVG') {
    super(chain);
  }
}
