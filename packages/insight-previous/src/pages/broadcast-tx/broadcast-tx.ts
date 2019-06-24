import { HttpClient } from '@angular/common/http';
import { Component, Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicPage, NavParams, ToastController } from 'ionic-angular';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { PriceProvider } from '../../providers/price/price';

@Injectable()
@IonicPage({
  name: 'broadcast-tx',
  segment: ':chain/:network/broadcast-tx',
  defaultHistory: ['home']
})
@Component({
  selector: 'page-broadcast-tx',
  templateUrl: 'broadcast-tx.html'
})
export class BroadcastTxPage {
  public title: string;
  public transaction: string;
  public txForm: FormGroup;

  private toast: any;
  private chainNetwork: ChainNetwork;

  constructor(
    private toastCtrl: ToastController,
    public formBuilder: FormBuilder,
    public navParams: NavParams,
    private httpClient: HttpClient,
    private apiProvider: ApiProvider,
    private logger: Logger,
    private priceProvider: PriceProvider,
    private currencyProvider: CurrencyProvider
  ) {
    const chain: string =
      navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      navParams.get('network') || this.apiProvider.getConfig().network;

    this.chainNetwork = {
      chain,
      network
    };

    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency();
    this.priceProvider.setCurrency();

    this.title = 'Broadcast Transaction';
    this.txForm = formBuilder.group({
      rawData: ['', Validators.pattern(/^[0-9A-Fa-f]+$/)]
    });
  }

  public send(): void {
    const postData: any = {
      rawtx: this.transaction
    };

    this.httpClient
      .post(this.apiProvider.getUrl() + '/tx/send', postData)
      .subscribe(
        response => {
          this.presentToast(true, response);
        },
        err => {
          this.logger.error(err.message);
          this.presentToast(false, err.message);
        }
      );
  }

  private presentToast(success: boolean, response: any): void {
    const message: string = success
      ? 'Transaction successfully broadcast. Trasaction id: ' + response.txid
      : 'An error occurred: ' + response;
    if (this.toast) {
      this.toast.dismiss();
    }

    this.toast = this.toastCtrl.create({
      message,
      position: 'bottom',
      showCloseButton: true,
      dismissOnPageChange: true
    });
    this.toast.present();
  }
}
