import { Component, Input, OnInit } from '@angular/core';
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

  public coins: any = [];
  public showTransactions: boolean;
  public loading = true;
  public limit = 10;
  public chunkSize = 100;

  constructor(
    private addrProvider: AddressProvider,
    private txsProvider: TxsProvider,
    private logger: Logger
  ) {}

  public ngOnInit(): void {
    if (this.coins && this.coins.length === 0) {
      this.addrProvider.getAddressActivity(this.addrStr).subscribe(
        data => {
          this.coins = data.map(this.txsProvider.toAppCoin);
          this.showTransactions = true;
          this.loading = false;
        },
        err => {
          this.logger.error(err);
          this.loading = false;
          this.showTransactions = false;
        }
      );
    } else {
      this.loading = false;
    }
  }

  public loadMore() {
    this.limit += this.chunkSize;
    this.chunkSize *= 2;
  }
}
