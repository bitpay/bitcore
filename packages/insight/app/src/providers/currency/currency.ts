import { Injectable } from '@angular/core';
import { DefaultProvider } from '../../providers/default/default';
import 'rxjs/add/operator/map';

/*
  Generated class for the CurrencyProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
 */
@Injectable()
export class CurrencyProvider {

  public defaultCurrency: string;
  public selectedCurrency: string;
  public currencySymbol: string;
  public factor: number = 1;
  public bitstamp: number;
  public kraken: number;
  public loading: boolean;
  public explorers: any = [];

  constructor(
    private defaults: DefaultProvider
  ) {
    this.defaultCurrency = defaults.getDefault('%DEFAULT_CURRENCY%');
    this.selectedCurrency = this.defaultCurrency.toLowerCase();
    this.currencySymbol = this.defaultCurrency;
  }

  public roundFloat(aFloat: number, decimalPlaces: number): number {
    return Math.round(aFloat * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
  }

  public getConvertedNumber(value: number): number {
    // TODO: Change this function to make use of satoshis so that we don't have to do all these roundabout conversions.
    value = value * 1e-8;
    if (value === 0.00000000) return 0;

    let response: number;

    if (this.currencySymbol === 'USD') {
      response = this.roundFloat((value * this.factor), 2);
    } else if (this.currencySymbol === 'm' + this.defaultCurrency) {
      this.factor = 1000;
      response = this.roundFloat((value * this.factor), 5);
    } else if (this.currencySymbol === 'bits') {
      this.factor = 1000000;
      response = this.roundFloat((value * this.factor), 2);
    } else {
      this.factor = 1;
      response = this.roundFloat((value * this.factor), 8);
    }

    return response;
  }

  /**
   * @deprecated use getConvertedNumber
   */
  public getConversion(value: number): string {
    if (value === 0.00000000) return '0 ' + this.currencySymbol; // fix value to show

    let response: number;

    if (this.currencySymbol === 'USD') {
      response = this.roundFloat((value * this.factor), 2);
    } else if (this.currencySymbol === 'm' + this.defaultCurrency) {
      this.factor = 1000;
      response = this.roundFloat((value * this.factor), 5);
    } else if (this.currencySymbol === 'bits') {
      this.factor = 1000000;
      response = this.roundFloat((value * this.factor), 2);
    } else {
      this.factor = 1;
      response = this.roundFloat((value * this.factor), 8);
    }
    return response + ' ' + this.currencySymbol;
  }
}
