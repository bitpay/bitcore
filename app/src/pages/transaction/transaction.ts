import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Http } from '@angular/http';

/**
 * Generated class for the TransactionPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'transaction',
  segment: 'tx/:txId'
})
@Component({
  selector: 'page-transaction',
  templateUrl: 'transaction.html',
})
export class TransactionPage {

  public loading: boolean = true;
  private txId: string;
  public tx: any = {};

  constructor(public navCtrl: NavController, public navParams: NavParams, private http: Http) {
    this.txId = navParams.get('txId');
  }

  ionViewDidLoad() {
    let apiPrefix: string = 'http://localhost:3001/insight-api/';

    this.http.get(apiPrefix + 'tx/' + this.txId).subscribe(
      (data) => {
        this.tx = JSON.parse(data['_body']);
        console.log('tx', this.tx);
        this.loading = false;
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }
}
