import { Component, Injectable, ViewChild } from '@angular/core';
import { Events, IonicPage, Nav, NavParams } from 'ionic-angular';
import { LatestBlocksComponent } from '../../components/latest-blocks/latest-blocks';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { PriceProvider } from '../../providers/price/price';

@Injectable()
@IonicPage({
  name: 'home',
  segment: ':chain/:network/home'
})
@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  @ViewChild('latestBlocks')
  public latestBlocks: LatestBlocksComponent;
  public chain: string;
  private chainNetwork: ChainNetwork;
  public network: string;
  constructor(
    public nav: Nav,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider,
    public events: Events,
    public currencyProvider: CurrencyProvider
  ) {
    const chain: string =
      navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      navParams.get('network') || this.apiProvider.getConfig().network;

    this.chainNetwork = {
      chain,
      network
    };
    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency();
    this.priceProvider.setCurrency();
  }

  public openPage(page: string): void {
    this.nav.push(page, {
      chain: this.chain,
      network: this.network
    });
  }
}
