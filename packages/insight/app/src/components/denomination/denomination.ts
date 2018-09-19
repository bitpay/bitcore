import { Component } from '@angular/core';
import { CurrencyProvider } from '../../providers/currency/currency';
import { App, NavController, ViewController } from 'ionic-angular';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import { PriceProvider } from '../../providers/price/price';

type ChainNetwork = { chain: string; network: string };

@Component({
  selector: 'denomination',
  templateUrl: 'denomination.html'
})
export class DenominationComponent {
  public switcherOn: boolean;
  public units: any = [];
  public enabledChains: Array<ChainNetwork> = [];
  public selected: ChainNetwork;

  constructor(
    public currencyProvider: CurrencyProvider,
    public priceProvider: PriceProvider,
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    public app: App,
    public http: Http,
    public api: ApiProvider
  ) {
    this.http.get(api.getUrlPrefix() + '/status/enabled-chains').subscribe(data => {
      this.enabledChains = data.json() as Array<ChainNetwork>;
      this.switcherOn = this.enabledChains.length > 1;
    });
    this.units = ['USD', this.api.selectedChain, 'm' + this.api.selectedChain];
  }

  public close(): void {
    this.viewCtrl.dismiss();
  }

  public changeExplorer(chainNetwork: ChainNetwork): void {
    this.selected = chainNetwork;
    const { chain, network }: ChainNetwork = chainNetwork;
    this.viewCtrl.dismiss();
    this.app.getRootNav().push('home', { chain, network});
  }
}
