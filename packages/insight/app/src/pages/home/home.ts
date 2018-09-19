import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { PriceProvider } from '../../providers/price/price';

/**
 * Generated class for the HomePage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
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
    const chain: string = navParams.get('chain') || apiProvider.selectedChain;
    const network: string = navParams.get('network') || apiProvider.selectedNetwork;
    this.priceProvider.setCurrency(chain);
    this.apiProvider.changeChain(chain, network);
  }
}
