import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { Http } from '@angular/http';

/**
 * Generated class for the TransactionListComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'transaction-list',
  templateUrl: 'transaction-list.html'
})
export class TransactionListComponent {

  public loading: boolean = true;
  @Input() public queryType: string;
  @Input() public queryValue: string;
  public transactions: any = [];

  constructor(private http: Http) {
  }

  private ngOnInit(): void {
    let apiPrefix: string = 'http://localhost:3001/insight-api/';

    let url: string = apiPrefix + 'txs?' + this.queryType + '=' + this.queryValue;

    this.http.get(url).subscribe(
      (data) => {
        this.transactions = JSON.parse(data['_body']);
        this.loading = false;

        this.transactions.txs.forEach((tx) => {
          console.log('tx is', tx);
        });
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }
}
