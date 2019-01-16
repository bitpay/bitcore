import { Component, Input } from '@angular/core';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { RedirProvider } from '../../providers/redir/redir';
import { AppCoin } from '../../providers/transactions/transactions';
@Component({
  selector: 'coin',
  templateUrl: 'coin.html'
})
export class CoinComponent {
  constructor(
    public apiProvider: ApiProvider,
    public currencyProvider: CurrencyProvider,
    public redirProvider: RedirProvider
  ) {}
  @Input()
  public coin: AppCoin | {} = {};

  public goToTx(txId: string): void {
    this.redirProvider.redir('transaction', {
      txId,
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    });
  }
}
