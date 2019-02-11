import { Component, Injectable, ViewChild } from '@angular/core';
import { Events, IonicPage, Nav, NavParams } from 'ionic-angular';
import { LatestBlocksComponent } from '../../components/latest-blocks/latest-blocks';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { PriceProvider } from '../../providers/price/price';

@Injectable()
@IonicPage({
  name: 'home',
  segment: 'home/:chain/:network'
})
@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  @ViewChild('latestBlocks')
  public latestBlocks: LatestBlocksComponent;
  public chain: string;
  public network: string;
  constructor(
    public nav: Nav,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider,
    public events: Events
  ) {
    const chainParam = navParams.get('chain');
    const networkParam = navParams.get('network');

    this.chain =
      chainParam ||
      this.apiProvider.networkSettings.value.selectedNetwork.chain;
    this.network =
      networkParam ||
      this.apiProvider.networkSettings.value.selectedNetwork.network;

    // Set rootPage for deep links
    if (!chainParam || !networkParam) {
      this.nav.setRoot('home', {
        chain: this.chain,
        network: this.network
      });
    }

    const chainNetwork: ChainNetwork = {
      chain: this.chain,
      network: this.network
    };
    this.apiProvider.changeNetwork(chainNetwork);
    this.loadView(chainNetwork, false);
  }

  public loadView(chainNetwork: ChainNetwork, currencyChanged: boolean) {
    const currentCurrency = localStorage.getItem('insight-currency');
    this.priceProvider.setCurrency(currentCurrency);
    if (currencyChanged) {
      this.latestBlocks.reloadData();
    }
  }

  public openPage(page: string): void {
    this.nav.push(page, {
      chain: this.chain,
      network: this.network
    });
  }
}
