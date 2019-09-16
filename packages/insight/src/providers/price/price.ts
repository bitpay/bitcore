import { Injectable } from '@angular/core';
import { ToastController } from 'ionic-angular';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { ApiProvider } from '../api/api';
import { CurrencyProvider } from '../currency/currency';

@Injectable()
export class PriceProvider {
  private rates = {};

  constructor(
    public currencyProvider: CurrencyProvider,
    public api: ApiProvider,
    private toastCtrl: ToastController
  ) {}

  public setCurrency(currency?: string): void {
    if (!currency) {
      currency = this.currencyProvider.getCurrency();
    }

    if (currency === 'USD') {
      let ratesAPI;
      switch (this.api.getConfig().chain) {
        case 'BTC':
          ratesAPI = this.api.ratesAPI.btc;
          break;
        case 'BCH':
          ratesAPI = this.api.ratesAPI.bch;
          break;
        case 'ETH':
          ratesAPI = this.api.ratesAPI.eth;
          break;
      }
      this.api.httpClient.get(ratesAPI).subscribe(
        (data: any) => {
          const currencyParsed: any = data;
          _.each(currencyParsed, o => {
            this.rates[o.code] = o.rate;
          });
          this.currencyProvider.factor = this.rates[currency];
          this.currencyProvider.loading = false;
        },
        () => {
          this.currencyProvider.loading = false;
          this.showErrorToast();
        }
      );
    } else {
      this.currencyProvider.factor =
        currency === 'm' + this.api.networkSettings.selectedNetwork.chain
          ? 1000
          : 1;
    }
  }

  // Get historical rates for currency at ts timestamp
  public getHistoricalRate(currency?: string, isoCode?: string, days?: number) {
    const dates = Array.apply(null, Array(days));
    const secondsInADay = 24 * 60 * 60;
    const today = Date.now();
    const observableBatch = [];

    // Get the X days in unix time
    dates.forEach(function(value, index) {
      this[index] = today - index * secondsInADay * 1000;
    }, dates);

    dates.reverse();

    _.forEach(dates, date => {
      const url =
        this.api.bwsUrl.urlPrefix +
        isoCode +
        '?coin=' +
        currency +
        '&' +
        'ts=' +
        date;
      observableBatch.push(this.api.httpClient.get(url));
    });
    return Observable.forkJoin(observableBatch);
  }

  private showErrorToast() {
    const toast: any = this.toastCtrl.create({
      message: 'This currency is not available at this time',
      duration: 3000,
      position: 'top'
    });
    toast.present();
    toast.onDidDismiss(() => {
      this.currencyProvider.setCurrency();
    });
  }
}
