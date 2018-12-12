import { Component } from '@angular/core';
import { Http } from '@angular/http';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { ApiCoin, TxsProvider } from '../../providers/transactions/transactions';

/**
 * Generated class for the AddressPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'address',
  segment: ':chain/:network/address/:addrStr'
})
@Component({
  selector: 'page-address',
  templateUrl: 'address.html'
})
export class AddressPage {
  public loading = true;
  private addrStr: string;
  public address: any = {};
  public transactions: any[] = [];
  public showTransactions: boolean;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private http: Http,
    public currencyProvider: CurrencyProvider,
    private apiProvider: ApiProvider,
    public txProvider: TxsProvider
  ) {
    this.addrStr = navParams.get('addrStr');
    const chain: string = navParams.get('chain');
    const network: string = navParams.get('network');
    this.apiProvider.changeNetwork({ chain, network });
  }

  public ionViewDidLoad(): void {
    const url = `${this.apiProvider.getUrl()}/address/${this.addrStr}/balance`;
    this.http.get(url).subscribe(
      data => {
        const json: {
          balance: number;
          numberTxs: number;
        } = data.json();
        this.address = {
          balance: json.balance,
          addrStr: this.addrStr
        };
        this.loading = false;
      },
      err => {
        console.error('err is', err);
      }
    );

    const txurl: string = this.apiProvider.getUrl() + '/address/' + this.addrStr + '/txs?limit=1000';
    this.http.get(txurl).subscribe(
      data => {
        const apiTx: ApiCoin[] = data.json() as ApiCoin[];
        this.transactions = apiTx.map(this.txProvider.toAppCoin);
        this.showTransactions = true;
      },
      err => {
        console.error('err is', err);
        this.loading = false;
        this.showTransactions = false;
      }
    );
  }

  public getBalance(): number {
    return this.currencyProvider.getConvertedNumber(this.address.balance);
  }
}
