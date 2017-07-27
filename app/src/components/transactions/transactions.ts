import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { Http } from '@angular/http';

/**
 * Generated class for the TransactionsComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'transactions',
  templateUrl: 'transactions.html'
})
export class TransactionsComponent {

  public loading: boolean = true;
  @Input() private blockHash: string;
  public transactions: any = [];

  constructor(private http: Http) {
    let apiPrefix: string = 'http://localhost:3001/insight-api/';

    this.http.get(apiPrefix + 'txs/' + this.blockHash).subscribe(
      (data) => {
        console.log('hey, got data');
        this.transactions = JSON.parse(data['_body']);
      },
      (err) => {
        console.log('err is', err);
      },
      () => {
        this.loading = false;
      }
    );
  }

}
