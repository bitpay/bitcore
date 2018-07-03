import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { TxsProvider } from '../../providers/transactions/transactions';

/**
 * Generated class for the AddressPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'address',
  segment: ':selectedCurrency/address/:addrStr'
})
@Component({
  selector: 'page-address',
  templateUrl: 'address.html'
})
export class AddressPage {
  public loading: boolean = true;
  private addrStr: string;
  public address: any = {};
  public transactions: any[];

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private http: Http,
    private api: ApiProvider,
    public currency: CurrencyProvider,
    public transaction: TxsProvider
  ) {
    this.addrStr = navParams.get('addrStr');
  }

  public ionViewDidLoad(): void {
    this.http.get(this.api.apiPrefix + '/address/' + this.addrStr).subscribe(
      data => {
        console.log(data);
        this.transactions = data.json().map(this.transaction.toAppTx);
        /*
         *this.address = JSON.parse(data['_body']);
         */
        /*
         *this.transactions = data;
         */
        this.loading = false;
      },
      err => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }
}
