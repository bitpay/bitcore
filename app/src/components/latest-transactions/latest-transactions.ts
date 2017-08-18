import { Component } from '@angular/core';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';

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

  private text: string;

  constructor(private http: Http, private api: ApiProvider) {
    console.log('Hello LatestTransactionsComponent Component');
    this.text = 'Hello Latest Transactions';

    /*
    let url: string = this.api.apiPrefix + 'txs?' + this.queryType + '=' + this.queryValue;

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

}
