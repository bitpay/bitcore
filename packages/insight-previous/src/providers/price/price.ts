import { Injectable } from '@angular/core';
import { ToastController } from 'ionic-angular';
import 'rxjs/add/operator/map';
import { ApiProvider } from '../api/api';
import { CurrencyProvider } from '../currency/currency';

@Injectable()
export class PriceProvider {

  constructor(public currency: CurrencyProvider, public api: ApiProvider, private toastCtrl: ToastController) { }

  public setCurrency(currency: string): void {
    this.currency.currencySymbol = currency;
    localStorage.setItem('insight-currency', currency);

    if (currency === 'USD') {
      this.api.http.get(this.api.getUrl() + '/currency').subscribe(
        data => {
          const currencyParsed: any = JSON.parse(data['_body']);
          if (currencyParsed.data.bitstamp) {
            this.currency.factor = this.currency.bitstamp =
              currencyParsed.data.bitstamp;
          } else if (currencyParsed.data.kraken) {
            this.currency.factor = this.currency.kraken =
              currencyParsed.data.kraken;
          }
          this.currency.loading = false;
        },
        err => {
          this.currency.loading = false;
          console.error('err getting currency', err);
          this.setDefaultCurrency();
        }
      );
    } else {
      this.currency.factor = currency ===
        'm' + this.api.networkSettings.value.selectedNetwork.chain ? 1000 : 1;
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
    })
  }
}
