import { Component, Input, OnInit } from '@angular/core';
import { Events } from 'ionic-angular';
import _ from 'lodash';
import { AddressProvider } from '../../providers/address/address';
import { Logger } from '../../providers/logger/logger';
import { TxsProvider } from '../../providers/transactions/transactions';

@Component({
  selector: 'coin-list',
  templateUrl: 'coin-list.html'
})
export class CoinListComponent implements OnInit {
  @Input()
  public addrStr?: string;

  public txs: any = [];
  public showTransactions: boolean;
  public loading;
  public limit = 10;
  public chunkSize = 100;

  constructor(
    private addrProvider: AddressProvider,
    private txsProvider: TxsProvider,
    private logger: Logger,
    private events: Events
  ) {}

  public ngOnInit(): void {
    if (this.txs && this.txs.length === 0) {
      this.loading = true;
      this.addrProvider.getAddressActivity(this.addrStr).subscribe(
        data => {
          const formattedData = data.map(this.txsProvider.toAppCoin);
          this.txs = this.orderByHeight(formattedData);
          this.showTransactions = true;
          this.loading = false;
          this.events.publish('CoinList', { length: data.length });
        },
        err => {
          this.logger.error(err);
          this.loading = false;
          this.showTransactions = false;
        }
      );
    }
  }

  orderByHeight(data) {
    const unconfirmedTxs = [];
    let confirmedTxs = [];

    data.forEach(tx => {
      const { mintHeight, mintTxid, value, spentHeight, spentTxid } = tx;

      mintHeight < 0
        ? unconfirmedTxs.push({ height: mintHeight, mintTxid, value })
        : confirmedTxs.push({ height: mintHeight, mintTxid, value });

      spentHeight < 0
        ? unconfirmedTxs.push({ height: spentHeight, spentTxid, value })
        : confirmedTxs.push({ height: spentHeight, spentTxid, value });
    });

    confirmedTxs = _.orderBy(confirmedTxs, ['height'], ['desc']);
    return unconfirmedTxs.concat(confirmedTxs);
  }

  public loadMore(infiniteScroll) {
    this.limit += this.chunkSize;
    this.chunkSize *= 2;
    infiniteScroll.complete();
  }
}
