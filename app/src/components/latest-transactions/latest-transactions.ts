import { Component, NgZone } from '@angular/core';
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
  private seconds: number = 10;

  constructor(private http: Http, private navCtrl: NavController, private api: ApiProvider, public currency: CurrencyProvider, ngZone: NgZone) {
    this.loadTransactions();
    ngZone.runOutsideAngular(() => {
      setInterval(
        function (): void {
          ngZone.run(function (): void {
            this.loadTransactions.call(this);
          }.bind(this));
        }.bind(this),
        1000 * this.seconds
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
