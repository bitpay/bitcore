import { Component, Injectable, ViewChild } from '@angular/core';
import { Events, IonicPage, Nav, NavParams } from 'ionic-angular';
import * as _ from 'lodash';
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
  public chainNetwork: ChainNetwork;
  public network: string;
  public availableNetworks;

  constructor(
    public nav: Nav,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider,
    public events: Events,
    public currencyProvider: CurrencyProvider
  ) {
    this.nav.viewWillEnter.subscribe(view => {
      if (view.data.chain === 'ALL') {
        this.load();
      }
    });
    this.load();
  }

  private load() {
    const chain: string =
      this.navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      this.navParams.get('network') || this.apiProvider.getConfig().network;

    this.chainNetwork = {
      chain,
      network
    };

    if (this.chainNetwork.chain === 'ALL') {
      this.apiProvider.getAvailableNetworks().subscribe(data => {
        const newNetworks = data
          .map(x => x.supported)
          .reduce((agg, arr) => [...agg].concat(arr), []);
        this.availableNetworks = _.filter(newNetworks, o => o.chain !== 'ALL');
      });
    }
    this.priceProvider.setCurrency();
    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency(this.chainNetwork);
  }

  public openPage(page: string): void {
    this.nav.push(page, {
      chain: this.chain,
      network: this.network
    });
  }
}
