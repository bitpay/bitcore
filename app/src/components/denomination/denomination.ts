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
  public currencies: any = [];
  public units: any = [];

  constructor(
    public currencyProvider: CurrencyProvider,
    public viewCtrl: ViewController
  ) {
    this.text = 'Hello World';
    this.switcherOn = true;
    this.currencies = [
      {
        name: 'Bitcoin',
        ticker: 'BTC',
        url: 'https://insight.bitpay.com'
      },
      {
        name: 'Bitcoin Cash',
        ticker: 'BCH',
        url: 'https://bch-insight.bitpay.com'
      }
    ];

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

  public changeCurrency(currency: any): void {
    console.log('selected currency is', currency.name, currency.ticker);
    this.close();
    let theUrl: string = currency.url;
    console.log('theUrl is', theUrl);
    window.location.href = theUrl;
  }
}
