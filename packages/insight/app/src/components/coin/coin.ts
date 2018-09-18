import { Input, Component } from '@angular/core';
import { AppCoin } from '../../providers/transactions/transactions';
import { CurrencyProvider } from '../../providers/currency/currency';
import { NavController } from 'ionic-angular/navigation/nav-controller';
import { ApiProvider } from '../../providers/api/api';
@Component({
  selector: 'coin',
  templateUrl: 'coin.html'
})
export class CoinComponent {
  constructor(
    public apiProvider: ApiProvider,
    public currencyProvider: CurrencyProvider,
    private navCtrl: NavController
  ) {}
  @Input() public coin: AppCoin = {} as AppCoin;

  public goToTx(txId: string): void {
    this.navCtrl.push('transaction', {
      chain: this.apiProvider.selectedChain,
      network: this.apiProvider.selectedNetwork,
      txId: txId
    });
  }
}
