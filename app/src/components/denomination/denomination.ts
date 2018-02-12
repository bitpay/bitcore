import { Component } from '@angular/core';
import { CurrencyProvider } from '../../providers/currency/currency';
import { ViewController } from 'ionic-angular';

@Component({
  selector: 'denomination',
  templateUrl: 'denomination.html'
})
export class DenominationComponent {

  public text: string;
  public switcherOn: boolean;
  public units: any = [];

  constructor(
    public currencyProvider: CurrencyProvider,
    public viewCtrl: ViewController
  ) {
    this.text = 'Hello World';
    this.switcherOn = true;

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
