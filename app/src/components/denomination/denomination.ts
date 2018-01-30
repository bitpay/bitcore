import { Component } from '@angular/core';
import { CurrencyProvider } from '../../providers/currency/currency';
import { ViewController } from 'ionic-angular';

@Component({
  selector: 'denomination',
  templateUrl: 'denomination.html'
})
export class DenominationComponent {

  public text: string;
  public units: any = [];

  constructor(
    public currency: CurrencyProvider,
    public viewCtrl: ViewController
  ) {
    this.text = 'Hello World';
    this.units = [
      'USD',
      this.currency.defaultCurrency,
      'm' + this.currency.defaultCurrency,
      'bits'
    ];
  }

  public close(): void {
    console.log('hey, closing');
    this.viewCtrl.dismiss();
  }

}
