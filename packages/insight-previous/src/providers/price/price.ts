import { Injectable } from '@angular/core';
import { ToastController } from 'ionic-angular';
import * as _ from 'lodash';
import { Logger } from '../../providers/logger/logger';
import { ApiProvider } from '../api/api';
import { CurrencyProvider } from '../currency/currency';

@Injectable()
export class PriceProvider {
  private rates = {};

  constructor(
    public currency: CurrencyProvider,
    public api: ApiProvider,
    private toastCtrl: ToastController,
    private logger: Logger
  ) {}

  public setCurrency(currency: string): void {
    this.currency.currencySymbol = currency;
    localStorage.setItem('insight-currency', currency);

    if (currency === 'USD') {
      const ratesAPI =
        this.api.getConfig().chain === 'BTC'
          ? this.api.ratesAPI.btc
          : this.api.ratesAPI.bch;
      this.api.http.get(ratesAPI).subscribe(
        (data: any) => {
          const currencyParsed: any = JSON.parse(data._body);
          _.each(currencyParsed, o => {
            this.rates[o.code] = o.rate;
          });
          this.currency.factor = this.rates[currency];
          this.currency.loading = false;
        },
        err => {
          this.currency.loading = false;
          this.logger.error(err);
          this.setDefaultCurrency();
        }
      );
    } else {
      this.currency.factor =
        currency === 'm' + this.api.networkSettings.value.selectedNetwork.chain
          ? 1000
          : 1;
    }
  }

  private setDefaultCurrency() {
    const toast: any = this.toastCtrl.create({
      message: 'This currency is not available at this time',
      duration: 3000,
      position: 'top'
    });
    toast.present();
    toast.onDidDismiss(() => {
      this.currency.factor = 1;
      this.currency.currencySymbol = this.api.getConfig().chain;
    });
  }
}
