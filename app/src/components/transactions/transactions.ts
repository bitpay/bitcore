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
  @Input() public blockHash: string;
  public transactions: any = [];

  constructor(private http: Http) {
  }

  private ngOnInit(): void {
    let apiPrefix: string = 'http://localhost:3001/insight-api/';

    this.http.get(apiPrefix + 'txs?block=' + this.blockHash).subscribe(
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

  public getAddress(vout: any): string {
    if (vout.scriptPubKey && vout.scriptPubKey.addresses) {
      return vout.scriptPubKey.addresses[0];
    } else {
      return 'Unparsed address';
    }
  }
}
