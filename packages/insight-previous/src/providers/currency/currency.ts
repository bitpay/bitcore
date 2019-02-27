import { Injectable } from '@angular/core';
import { ApiProvider } from '../api/api';

@Injectable()
export class CurrencyProvider {
  public currencySymbol: string;
  public factor = 1;
  public bitstamp: number;
  public kraken: number;
  public loading: boolean;
  public explorers: any = [];

  constructor(private apiProvider: ApiProvider) {}

  public roundFloat(aFloat: number, decimalPlaces: number): number {
    return (
      Math.round(aFloat * Math.pow(10, decimalPlaces)) /
      Math.pow(10, decimalPlaces)
    );
  }

  public setCurrency(currency?: string): void {
    if (!currency) {
      currency =
        localStorage.getItem('insight-currency') ||
        this.apiProvider.networkSettings.value.selectedNetwork.chain.toUpperCase();
    }

    if (currency !== 'USD') {
      const chain = this.apiProvider.networkSettings.value.selectedNetwork.chain.toUpperCase();
      this.currencySymbol = currency.startsWith('m') ? 'm' + chain : chain;
    } else {
      this.currencySymbol = 'USD';
    }
  }

  public getCurrency(): string {
    return this.currencySymbol;
  }

  public getConvertedNumber(value: number): number {
    // TODO: Change this function to make use of satoshis so that we don't have to do all these roundabout conversions.
    value = value * 1e-8;
    if (value === 0.0) {
      return 0;
    }

    let response: number;

    if (this.currencySymbol === 'USD') {
      response = this.roundFloat(value * this.factor, 2);
    } else if (
      this.currencySymbol ===
      'm' + this.apiProvider.networkSettings.value.selectedNetwork.chain
    ) {
      this.factor = 1000;
      response = this.roundFloat(value * this.factor, 5);
    } else if (this.currencySymbol === 'bits') {
      this.factor = 1000000;
      response = this.roundFloat(value * this.factor, 2);
    } else {
      this.factor = 1;
      response = this.roundFloat(value * this.factor, 8);
    }

    return response;
  }

  /**
   * @deprecated use getConvertedNumber
   */
  public getConversion(value: number): string {
    if (value === 0.0) {
      return '0 ' + this.currencySymbol; // fix value to show
    }

    let response: number;

    if (this.currencySymbol === 'USD') {
      response = this.roundFloat(value * this.factor, 2);
    } else if (
      this.currencySymbol ===
      'm' + this.apiProvider.networkSettings.value.selectedNetwork.chain
    ) {
      this.factor = 1000;
      response = this.roundFloat(value * this.factor, 5);
    } else if (this.currencySymbol === 'bits') {
      this.factor = 1000000;
      response = this.roundFloat(value * this.factor, 2);
    } else {
      this.factor = 1;
      response = this.roundFloat(value * this.factor, 8);
    }
    return response + ' ' + this.currencySymbol;
  }
}
