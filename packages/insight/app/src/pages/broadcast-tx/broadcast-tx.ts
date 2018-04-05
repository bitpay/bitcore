import { Component } from '@angular/core';
import { IonicPage } from 'ionic-angular';
import { ToastController } from 'ionic-angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';

@IonicPage()
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

  constructor(
    private toastCtrl: ToastController,
    public formBuilder: FormBuilder,
    private http: Http,
    private api: ApiProvider,
  ) {
    this.title = 'Broadcast Transaction';
    this.txForm = formBuilder.group({
      rawData: ['', Validators.pattern(/^[0-9A-Fa-f]+$/)]
    });
  }

  public send(): void {
    let postData: any = {
      rawtx: this.transaction
    };
    this.status = 'loading';

    this.http.post(this.api.apiPrefix + 'tx/send', postData)
    .subscribe(
      response => {
        this.presentToast(true, response);
      },
      err => {
        this.presentToast(false, err);
      }
    );
  }

  private presentToast(success: boolean, response: any): void {
    let message: string = (success) ? 'Transaction successfully broadcast. Trasaction id: ' + JSON.parse(response._body).txid : 'An error occurred: ' + response._body;
    if (this.toast) {
      this.toast.dismiss();
    }

    this.toast = this.toastCtrl.create({
      message: message,
      position: 'middle',
      showCloseButton: true,
      dismissOnPageChange: true
    });
    this.toast.present();
  }
}
