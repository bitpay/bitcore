import { Component, ViewChild } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { LatestBlocksComponent } from '../../components/latest-blocks/latest-blocks';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { PriceProvider } from '../../providers/price/price';

@IonicPage({
  name: 'home',
  segment: ':chain/:network'
})
@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  @ViewChild('latestBlocks') latestBlocks: LatestBlocksComponent;
  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider
  ) {
    const chainNetwork: ChainNetwork = {
      chain:
        navParams.get('chain') ||
        this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network:
        navParams.get('network') ||
        this.apiProvider.networkSettings.value.selectedNetwork.network
    }
    this.loadView(chainNetwork, false);
  }

  public loadView(chainNetwork: ChainNetwork, currencyChanged: boolean) {
    this.priceProvider.setCurrency(chainNetwork.chain);
    if (currencyChanged) {
      this.latestBlocks.blocks = [];
      this.latestBlocks.loadBlocks();
    }
  }
}
