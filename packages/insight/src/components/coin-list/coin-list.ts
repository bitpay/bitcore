import { Component, Input, OnInit } from '@angular/core';
import { Events } from 'ionic-angular';
import _ from 'lodash';
import { AddressProvider } from '../../providers/address/address';
import { ChainNetwork } from '../../providers/api/api';
import { TxsProvider } from '../../providers/transactions/transactions';

@Component({
  selector: 'coin-list',
  templateUrl: 'coin-list.html'
})
export class CoinListComponent implements OnInit {
  @Input()
  public addrStr?: string;
  @Input()
  public chainNetwork: ChainNetwork;

  public txs: any = [];
  public coins: any = [];
  public showTransactions: boolean;
  public loading;
  public limit = 10;
  public chunkSize = 100;

  constructor(
    private addrProvider: AddressProvider,
    private txsProvider: TxsProvider,
    private events: Events
  ) {}

  public ngOnInit(): void {
    if (this.txs && this.txs.length === 0) {
      this.loading = true;
      this.addrProvider.getAddressActivity(this.addrStr, this.chainNetwork).subscribe(
        data => {
          const toAppCoin: any = this.chainNetwork.chain !== 'ETH' ? this.txsProvider.toAppCoin: this.txsProvider.toAppEthCoin;
          const formattedData = data.map(toAppCoin);
          this.txs = this.chainNetwork.chain !== 'ETH' ? this.processData(formattedData): formattedData;
          this.showTransactions = true;
          this.loading = false;
          this.events.publish('CoinList', { length: data.length });
        },
        () => {
          this.loading = false;
          this.showTransactions = false;
        }
      );
    }
  }

  processData(data) {
    const txs = [];
    data.forEach(tx => {
      const { mintHeight, mintTxid, value, spentHeight, spentTxid } = tx;
      txs.push({ height: spentHeight, spentTxid, value });
      txs.push({ height: mintHeight, mintTxid, value });
    });
    return txs;
  }

  public loadMore(infiniteScroll) {
    this.limit += this.chunkSize;
    this.chunkSize *= 2;
    infiniteScroll.complete();
  }
}
