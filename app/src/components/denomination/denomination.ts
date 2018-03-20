import { Component } from '@angular/core';
import { CurrencyProvider } from '../../providers/currency/currency';
import { ViewController } from 'ionic-angular';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';

@Component({
  selector: 'denomination',
  templateUrl: 'denomination.html'
})
export class DenominationComponent {

  public switcherOn: boolean;
  public units: any = [];

  constructor(
    public currencyProvider: CurrencyProvider,
    public viewCtrl: ViewController,
    public http: Http,
    public api: ApiProvider
  ) {
    this.units = [
      'USD',
      this.currencyProvider.defaultCurrency,
      'm' + this.currencyProvider.defaultCurrency,
      'bits'
    ];

    this.switcherOn = currencyProvider.explorers.length > 1;
  }

  public close(): void {
    this.viewCtrl.dismiss();
  }

  public changeExplorer(explorer: any): void {
    this.close();
    let theUrl: string = explorer.url;
    window.location.href = theUrl;
  }
}
