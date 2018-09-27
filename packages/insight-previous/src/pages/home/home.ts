import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
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
  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider
  ) {
    const chain: string =
      navParams.get('chain') ||
      apiProvider.networkSettings.value.selectedNetwork.chain;
    const network: string =
      navParams.get('network') ||
      apiProvider.networkSettings.value.selectedNetwork.network;
    this.priceProvider.setCurrency(chain);
    this.apiProvider.changeNetwork({ chain, network });
  }
}
