import { Component, Input, NgZone, OnChanges } from '@angular/core';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { RedirProvider } from '../../providers/redir/redir';

@Component({
  selector: 'latest-transactions',
  templateUrl: 'latest-transactions.html'
})
export class LatestTransactionsComponent implements OnChanges {
  @Input()
  public refreshSeconds = 10;
  private timer: any;
  private loading = true;
  private transactions = [];

  constructor(
    private http: Http,
    private apiProvider: ApiProvider,
    public currency: CurrencyProvider,
    private ngZone: NgZone,
    public redirProvider: RedirProvider,
    private logger: Logger
  ) {
    this.loadTransactions();
  }

  public ngOnChanges(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.ngZone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        this.ngZone.run(() => {
          this.loadTransactions.call(this);
        });
      }, 1000 * this.refreshSeconds);
    });
  }

  private loadTransactions(): void {
    const url: string = this.apiProvider.getUrl() + 'txs';

    this.http.get(url).subscribe(
      (data: any) => {
        this.transactions = JSON.parse(data._body);
        this.loading = false;
      },
      err => {
        this.logger.error(err);
        this.loading = false;
      }
    );
  }

  public goToTx(txId: string): void {
    this.redirProvider.redir('transaction', {
      txId,
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    });
  }
}
