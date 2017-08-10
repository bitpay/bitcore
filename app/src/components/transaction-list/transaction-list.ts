import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';

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

  constructor(private http: Http, private api: ApiProvider) {
  }

  private ngOnInit(): void {
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
  }
}
