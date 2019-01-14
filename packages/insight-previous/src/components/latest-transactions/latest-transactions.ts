import { Component, Input, NgZone } from '@angular/core';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { RedirProvider } from '../../providers/redir/redir';

/**
 * Generated class for the LatestTransactionsComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'latest-transactions',
  templateUrl: 'latest-transactions.html'
})
export class LatestTransactionsComponent {

  @Input() public refreshSeconds = 10;
  private timer: number;
  private loading = true;
  private transactions = [];

  constructor(private http: Http, private api: ApiProvider, public currency: CurrencyProvider, private ngZone: NgZone, public redirProvider: RedirProvider) {
    this.loadTransactions();
  }

  // tslint:disable-next-line:use-life-cycle-interface
  public ngOnChanges(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.ngZone.runOutsideAngular(() => {
      this.timer = setInterval(
        function (): void {
          this.ngZone.run(function (): void {
            this.loadTransactions.call(this);
          }.bind(this));
        }.bind(this),
        1000 * this.refreshSeconds
      );
    });
  }

  private loadTransactions(): void {
    const url: string = this.api.getUrl() + 'txs';

    this.http.get(url).subscribe(
      (data) => {
        this.transactions = JSON.parse(data['_body']);
        this.loading = false;
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }

  public goToTx(txId: string): void {
    this.redirProvider.redir('transaction', txId)
  }
}
