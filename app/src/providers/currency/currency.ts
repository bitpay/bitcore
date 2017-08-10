import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';

/*
  Generated class for the CurrencyProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/
@Injectable()
export class CurrencyProvider {

  private defaultCurrency: string;
  private currencySymbol: string;
  private factor: number = 1;

  constructor(public http: Http) {
    this.defaultCurrency = 'BTC';
    this.currencySymbol = this.defaultCurrency;
  }

  private roundFloat(aFloat: number, decimalPlaces: number): number {
    return Math.round(aFloat * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
  }

  public getConversion(value: number): string {
    if (value === 0.00000000) return '0 ' + this.currencySymbol; // fix value to show

    let response: number;

    if (this.currencySymbol === 'USD') {
      response = this.roundFloat((value * this.factor), 2);
    } else if (this.currencySymbol === 'mBTC') {
      this.factor = 1000;
      response = this.roundFloat((value * this.factor), 5);
    } else if (this.currencySymbol === 'bits') {
      this.factor = 1000000;
      response = this.roundFloat((value * this.factor), 2);
    } else { // assumes currencySymbol is BTC
      this.factor = 1;
      response = this.roundFloat((value * this.factor), 8);
    }

    return response + ' ' + this.currencySymbol;
  }

  public setCurrency(currency: string): void {
    this.currencySymbol = currency;
    localStorage.setItem('insight-currency', currency);

    if (currency === 'USD') {
      // TODO Replace this with call
      /*
      Currency.get({}, function(res) {
        $rootScope.currency.factor = $rootScope.currency.bitstamp = res.data.bitstamp;
      });
       */
    } else if (currency === 'mBTC') {
      this.factor = 1000;
    } else if (currency === 'bits') {
      this.factor = 1000000;
    } else {
      this.factor = 1;
    }
  }

}
