import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { TxsProvider } from '../../providers/transactions/transactions';

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

  constructor(private txProvider: TxsProvider) {
  }

  private ngOnInit(): void {
    this.txProvider.getTxs({[this.queryType]: this.queryValue}).subscribe(
      (data) => {
        this.transactions = data.txs;
        this.loading = false;
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }
}
