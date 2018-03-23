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
        this.presentToast(response);
      },
      err => console.log('err', err)
    );
  }

  private presentToast(response: any): void {
    let body: any = JSON.parse(response._body);
    let toast: any = this.toastCtrl.create({
      message: 'Transaction successfully broadcast. Trasaction id: ' + body.txid,
      position: 'middle',
      showCloseButton: true,
      dismissOnPageChange: true
    });
    toast.present();
  }
}
