import { Component, OnInit } from '@angular/core';
import { Input } from '@angular/core';
import { TxsProvider } from '../../providers/transactions/transactions';

@Component({
  selector: 'transaction-list',
  templateUrl: 'transaction-list.html'
})
export class TransactionListComponent implements OnInit {
  public loading = true;
  @Input()
  public queryType?: string;
  @Input()
  public queryValue?: string;
  @Input()
  public transactions?: any = [];

  limit = 10;
  chunkSize = 100;

  constructor(private txProvider: TxsProvider) {}

  ngOnInit(): void {
    if (this.transactions && this.transactions.length === 0) {
      this.txProvider.getTxs({ [this.queryType]: this.queryValue }).subscribe(
        data => {
          this.transactions = data.txs;
          this.loading = false;
        },
        err => {
          console.log('err is', err);
          this.loading = false;
        }
      );
    } else {
      this.loading = false;
    }
  }

  loadMore() {
    this.limit += this.chunkSize;
    this.chunkSize *= 2;
  }
}
