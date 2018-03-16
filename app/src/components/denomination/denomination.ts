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
  private explorers: any = [];
  public units: any = [];

  constructor(
    public currencyProvider: CurrencyProvider,
    public viewCtrl: ViewController,
    public http: Http,
    public api: ApiProvider
  ) {

    let url: string = this.api.apiPrefix + 'explorers';
    this.http.get(url).subscribe(
      (data) => {
        this.explorers = JSON.parse(data['_body']);
        this.switcherOn = true;
      },
      (err) => {
        this.switcherOn = false;
        console.error('err', err);
      }
    );

    this.units = [
      'USD',
      this.currencyProvider.defaultCurrency,
      'm' + this.currencyProvider.defaultCurrency,
      'bits'
    ];
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
