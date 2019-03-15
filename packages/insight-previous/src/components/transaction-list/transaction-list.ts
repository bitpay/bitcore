import { Component, Input, OnInit } from '@angular/core';
import { Logger } from '../../providers/logger/logger';
import { TxsProvider } from '../../providers/transactions/transactions';

import * as _ from 'lodash';

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
  public limit = 10;
  public chunkSize = 100;

  constructor(private txProvider: TxsProvider, private logger: Logger) {}

  public ngOnInit(): void {
    if (this.transactions && this.transactions.length === 0) {
      this.txProvider.getTxs({ [this.queryType]: this.queryValue }).subscribe(
        response => {
          // Newly Generated Coins (Coinbase) First
          const txs = response.map(tx => this.txProvider.toAppTx(tx));
          const sortedTxs = _.sortBy(txs, (tx: any) => {
            return tx.isCoinBase ? 0 : 1;
          });
          this.transactions = sortedTxs;
          this.loading = false;
        },
        err => {
          this.logger.error(err);
          this.loading = false;
        }
      );
    } else {
      this.loading = false;
    }
  }

  public loadMore(infiniteScroll) {
    this.limit += this.chunkSize;
    this.chunkSize *= 2;
    infiniteScroll.complete();
  }
}
