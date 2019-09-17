import { Component, Input, OnInit } from '@angular/core';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { AddressProvider } from '../../providers/address/address';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
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
  @Input()
  public chainNetwork: ChainNetwork;
  public limit = 10;
  public chunkSize = 100;

  constructor(
    private txProvider: TxsProvider,
    private api: ApiProvider,
    private addrProvider: AddressProvider
  ) {}

  public ngOnInit(): void {
    if (this.transactions && this.transactions.length === 0) {
      if (this.queryType === 'blockHash') {
        this.txProvider
          .getTxs(this.chainNetwork, { [this.queryType]: this.queryValue })
          .subscribe(
            response => {
              const txIds = [];

              _.forEach(response, tx => {
                txIds.push(tx.txid);
              });

              const txsPopulated = [];
              const observableBatch = [];

              _.forEach(txIds, value => {
                observableBatch.push(
                  this.txProvider.getTx(value, this.chainNetwork)
                );
              });

              Observable.forkJoin(observableBatch).subscribe((txs: any[]) => {
                _.forEach(response, tx => {
                  if (
                    this.chainNetwork.chain === 'BTC' ||
                    this.chainNetwork.chain === 'BCH'
                  ) {
                    txsPopulated.push(this.txProvider.toUtxoCoinsAppTx(tx));
                  }
                  if (this.chainNetwork.chain === 'ETH') {
                    txsPopulated.push(this.txProvider.toEthAppTx(tx as any));
                  }
                });

                // Newly Generated Coins (Coinbase) First
                const sortedTxs = _.sortBy(txsPopulated, (tx: any) => {
                  return tx.isCoinBase ? 0 : 1;
                });
                this.transactions = sortedTxs;
              });
              this.loading = false;
            },
            () => {
              this.loading = false;
            }
          );
      } else if (this.queryType === 'address') {
        this.addrProvider
          .getAddressActivity(this.queryValue)
          .subscribe((response: any) => {
            const mintedTxIds = [];
            const spentTxIds = [];

            _.forEach(response, tx => {
              if (tx.mintTxId !== '') {
                mintedTxIds.push(tx.mintTxid);
              } else if (tx.spentTxId !== '') {
                spentTxIds.push(tx.spentTxid);
              }
            });

            const txsPopulated = [];
            const observableBatch = [];

            _.forEach(mintedTxIds, tx => {
              this.txProvider.getTx(tx, this.chainNetwork);
              observableBatch.push(
                this.txProvider.getTx(tx, this.chainNetwork)
              );
            });

            _.forEach(spentTxIds, tx => {
              this.txProvider.getTx(tx, this.chainNetwork);
              observableBatch.push(
                this.txProvider.getTx(tx, this.chainNetwork)
              );
            });

            Observable.forkJoin(observableBatch).subscribe((txs: any) => {
              _.forEach(txs, tx => {
                if (
                  this.chainNetwork.chain === 'BTC' ||
                  this.chainNetwork.chain === 'BCH'
                ) {
                  txsPopulated.push(this.txProvider.toUtxoCoinsAppTx(tx));
                }
                if (this.chainNetwork.chain === 'ETH') {
                  txsPopulated.push(this.txProvider.toEthAppTx(tx));
                }
              });

              // Newly Generated Coins (Coinbase) First
              const sortedTxs = _.sortBy(txsPopulated, (tx: any) => {
                return tx.isCoinBase ? 0 : 1;
              });
              this.transactions = sortedTxs;
            });

            this.loading = false;
          });
      }
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
