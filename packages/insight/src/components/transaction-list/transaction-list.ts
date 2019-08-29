import { Component, Input, OnInit } from '@angular/core';
import { ChainNetwork } from '../../providers/api/api';
import { ApiEthTx, ApiUtxoCoinTx, TxsProvider } from '../../providers/transactions/transactions';

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
  @Input()
  public chainNetwork: ChainNetwork;
  public limit = 10;
  public chunkSize = 100;

  constructor(private txProvider: TxsProvider) {}

  public ngOnInit(): void {
    if (this.transactions && this.transactions.length === 0) {
      this.txProvider
        .getTxs(this.chainNetwork, { [this.queryType]: this.queryValue })
        .subscribe(
          response => {            
            // Newly Generated Coins (Coinbase) First
            const txs = response.map((tx: ApiEthTx & ApiUtxoCoinTx) => {
              if(this.chainNetwork.chain === "BTC" || this.chainNetwork.chain === "BCH") {
                return this.txProvider.toUtxoCoinsAppTx(tx)
              }
              if(this.chainNetwork.chain === "ETH") {
                return this.txProvider.toEthAppTx(tx)
              }
            });
            const sortedTxs = _.sortBy(txs, (tx: any) => {
              return tx.isCoinBase ? 0 : 1;
            });
            this.transactions = sortedTxs;
            this.loading = false;
          },
          () => {
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
