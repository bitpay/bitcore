import { Input, Component } from '@angular/core';
import { AppCoin } from '../../providers/transactions/transactions';
import { CurrencyProvider } from '../../providers/currency/currency';
@Component({
  selector: 'coin',
  templateUrl: 'coin.html'
})
export class CoinComponent {
  constructor(public currency: CurrencyProvider) {}
  @Input() public coin: AppCoin = {} as AppCoin;
}
