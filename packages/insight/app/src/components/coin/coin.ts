import { Input, Component } from '@angular/core';
import { AppCoin } from '../../providers/transactions/transactions';
import { CurrencyProvider } from '../../providers/currency/currency';
import { NavController } from 'ionic-angular/navigation/nav-controller';
@Component({
  selector: 'coin',
  templateUrl: 'coin.html'
})
export class CoinComponent {
  constructor(public currency: CurrencyProvider, private navCtrl: NavController) {}
  @Input() public coin: AppCoin = {} as AppCoin;

  public goToTx(txId: string): void {
    this.navCtrl.push('transaction', {
      selectedCurrency: this.currency.selectedCurrency,
      txId: txId
    });
  }
}
