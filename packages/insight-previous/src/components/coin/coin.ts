import { Component, Input } from '@angular/core';
import { NavController } from 'ionic-angular/navigation/nav-controller';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { AppCoin } from '../../providers/transactions/transactions';
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
  @Input()
  public coin: AppCoin | {} = {};

  public goToTx(txId: string): void {
    this.navCtrl.push('transaction', {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network,
      txId
    });
  }
}
