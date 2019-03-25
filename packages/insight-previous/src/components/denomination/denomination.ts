import { Component } from '@angular/core';
import { NavParams, ViewController } from 'ionic-angular';
import _ from 'lodash';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
@Component({
  selector: 'denomination',
  templateUrl: 'denomination.html'
})
export class DenominationComponent {
  public units: any = [];
  public availableNetworks;
  public currencySymbol;
  public showUnits = false;

  constructor(
    public viewCtrl: ViewController,
    public api: ApiProvider,
    public navParams: NavParams
  ) {}

  public ionViewDidLoad() {
    this.currencySymbol = this.navParams.data.currencySymbol;
    this.api.getAvailableNetworks().subscribe(data => {
      this.availableNetworks = data;
      this.showUnits = _.some(
        this.availableNetworks,
        this.api.networkSettings.value.selectedNetwork
      )
        ? true
        : false;
      this.units = [
        'USD',
        this.api.networkSettings.value.selectedNetwork.chain,
        'm' + this.api.networkSettings.value.selectedNetwork.chain
      ];
    });
  }

  public changeUnit(unit: string): void {
    this.currencySymbol = unit;
    this.viewCtrl.dismiss({
      chainNetwork: this.navParams.data.config,
      currencySymbol: this.currencySymbol
    });
  }

  public changeExplorer(chainNetwork: ChainNetwork): void {
    this.viewCtrl.dismiss({
      chainNetwork,
      currencySymbol: this.currencySymbol
    });
  }
}
