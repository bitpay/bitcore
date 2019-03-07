import { Component, Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Http } from '@angular/http';
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
  private status: string;
  private toast: any;
  private chainNetwork: ChainNetwork;

  constructor(
    private toastCtrl: ToastController,
    public formBuilder: FormBuilder,
    public navParams: NavParams,
    private http: Http,
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
    this.status = 'loading';

    this.http.post(this.apiProvider.getUrl() + '/tx/send', postData).subscribe(
      response => {
        this.presentToast(true, response);
      },
      err => {
        this.logger.error(err._body);
        this.presentToast(false, err);
      }
    );
  }

  private presentToast(success: boolean, response: any): void {
    const message: string = success
      ? 'Transaction successfully broadcast. Trasaction id: ' +
        JSON.parse(response._body).txid
      : 'An error occurred: ' + response._body;
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
