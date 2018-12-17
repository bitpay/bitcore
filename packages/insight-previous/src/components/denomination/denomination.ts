import { Component } from '@angular/core';
import { Http } from '@angular/http';
import { App, NavController, ViewController } from 'ionic-angular';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { PriceProvider } from '../../providers/price/price';

@Component({
  selector: 'denomination',
  templateUrl: 'denomination.html'
})
export class DenominationComponent {
  public switcherOn: boolean;
  public units: any = [];
  public enabledChains: ChainNetwork[] = [];
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
    this.switcherOn = this.api.networkSettings.value.availableNetworks.length > 0 ? true : false;
    this.units = [
      'USD',
      this.api.networkSettings.value.selectedNetwork.chain,
      'm' + this.api.networkSettings.value.selectedNetwork.chain
    ];
  }

  public close(): void {
    this.viewCtrl.dismiss();
  }

  public changeExplorer(chainNetwork: ChainNetwork): void {
    this.selected = chainNetwork;
    this.viewCtrl.dismiss(chainNetwork);
  }
}
