import { Component, Input } from '@angular/core';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { RedirProvider } from '../../providers/redir/redir';
import { AppCoin } from '../../providers/transactions/transactions';
@Component({
  selector: 'coin',
  templateUrl: 'coin.html'
})
export class CoinComponent {
  @Input()
  public coin: AppCoin | {} = {};
  @Input()
  public chainNetwork: ChainNetwork;

  constructor(
    public apiProvider: ApiProvider,
    public currencyProvider: CurrencyProvider,
    public redirProvider: RedirProvider
  ) {}

  public goToTx(txId: string): void {
    this.redirProvider.redir('transaction', {
      txId,
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    });
  }
}
