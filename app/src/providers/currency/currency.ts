import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import 'rxjs/add/operator/map';

/*
  Generated class for the CurrencyProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/
@Injectable()
export class CurrencyProvider {

  public defaultCurrency: string;
  public currencySymbol: string;
  public factor: number = 1;
  private bitstamp: number;
  private loading: boolean;

  constructor(public http: Http, private api: ApiProvider) {
    this.defaultCurrency = 'BTC';
    this.currencySymbol = this.defaultCurrency;
  }

  public roundFloat(aFloat: number, decimalPlaces: number): number {
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
      this.http.get(this.api.apiPrefix + 'currency').subscribe(
        (data) => {
          let currencyParsed: any = JSON.parse(data['_body']);
          this.factor = this.bitstamp = currencyParsed.data.bitstamp;
          this.loading = false;
        },
        (err) => {
          console.log('err is', err);
          this.loading = false;
        }
      );
    } else if (currency === 'mBTC') {
      this.factor = 1000;
    } else if (currency === 'bits') {
      this.factor = 1000000;
    } else {
      this.factor = 1;
    }
  }

}
