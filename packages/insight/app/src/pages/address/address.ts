import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { TxsProvider, ApiInput } from '../../providers/transactions/transactions';

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
        let apiCoin: ApiInput[] = data.json() as ApiInput[];
        let add: (prev: number, cur: number) => number = (prev, cur) => prev + cur;
        let sentCoin: ApiInput[] = apiCoin.filter(coin => coin.spentTxid);
        let unspentCoin: ApiInput[] = apiCoin.filter(coin => !coin.spentTxid);
        let totalReceived: number = apiCoin.map(c => c.value).reduce(add, 0);
        let totalSent: number = sentCoin.map(c => c.value).reduce(add, 0);
        let balance: number = totalReceived - totalSent;
        console.log(apiCoin);
        this.address = {
          addrStr: this.addrStr,
          totalReceived,
          totalSent,
          balance,
          txAppearances: apiCoin.length
        };
        this.transactions = apiCoin;
        this.loading = false;
      },
      err => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }
}
