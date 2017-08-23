import { Component, NgZone, Input } from '@angular/core';
import { Http } from '@angular/http';
import { NavController } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';

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

  private loading: boolean = true;
  private transactions: Array<any> = [];
  @Input() public refreshSeconds: number = 10;
  private timer: number;

  constructor(private http: Http, private navCtrl: NavController, private api: ApiProvider, public currency: CurrencyProvider, private ngZone: NgZone) {
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
    let url: string = this.api.apiPrefix + 'txs';

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
    this.navCtrl.push('transaction', {
      'txId': txId
    });
  }
}
