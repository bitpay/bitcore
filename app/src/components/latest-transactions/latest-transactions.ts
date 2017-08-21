import { Component } from '@angular/core';
// import { Http } from '@angular/http';
// import { ApiProvider } from '../../providers/api/api';
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

  // private loading: boolean = true;
  private transactions: Array<any> = [
    {
      hash: '12345',
      out: 0.001
    },
    {
      hash: '22345',
      out: 0.002
    }
  ];

  constructor(/*private http: Http, private api: ApiProvider*/ public currency: CurrencyProvider) {

    // let url: string = this.api.apiPrefix + 'txs';

    /*
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
     */

    /*
    this.http.get(this.api.apiPrefix + 'tx/' + this.txId).subscribe(
      (data) => {
        this.tx = JSON.parse(data['_body']);
        this.loading = false;
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
     */
  }

  public getTransactions(): Array<any> {
    return this.transactions;
  }

}
