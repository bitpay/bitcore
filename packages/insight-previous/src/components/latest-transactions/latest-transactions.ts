import { Component, Injectable, Input, NgZone } from '@angular/core';
import { Http } from '@angular/http';
import { NavController } from 'ionic-angular';
import { Logger } from '../../logger';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';

@Injectable()

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

  private loading = true;
  private transactions: any[] = [];
  @Input() public refreshSeconds = 10;
  private timer: number;

  constructor(private http: Http, private navCtrl: NavController, private api: ApiProvider, public currency: CurrencyProvider, private ngZone: NgZone, private logger: Logger) {
    this.loadTransactions();
  }

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
        this.logger.error(err);
        this.loading = false;
      }
    );
  }

  public goToTx(txId: string): void {
    this.navCtrl.push('transaction', {
      'selectedCurrency': this.currency.selectedCurrency,
      'txId': txId
    });
  }
}
