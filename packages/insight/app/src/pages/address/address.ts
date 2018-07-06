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
    private apiProvider: ApiProvider,
    public currencyProvider: CurrencyProvider,
    public txProvider: TxsProvider
  ) {
    this.addrStr = navParams.get('addrStr');
  }

  public ionViewDidLoad(): void {
    let url = this.apiProvider.apiPrefix + '/address/' + this.addrStr;
    this.http.get(url).subscribe(
      data => {
        this.address = data.json()[0];
        this.transactions = data.json().map(this.txProvider.toAppTx);
        this.loading = false;
      },
      err => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }
}
