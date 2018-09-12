import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { TxsProvider, ApiTx, ApiCoin } from '../../providers/transactions/transactions';
import { BlocksProvider } from '../../providers/blocks/blocks';

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
  public transactions: any[] = [];

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private http: Http,
    private apiProvider: ApiProvider,
    public currencyProvider: CurrencyProvider,
    public txProvider: TxsProvider,
    public blocks: BlocksProvider
  ) {
    this.addrStr = navParams.get('addrStr');
  }

  public ionViewDidLoad(): void {
    const url: string = `${this.apiProvider.apiPrefix}/address/${this.addrStr}/balance`;
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

    let txurl: string = this.apiProvider.apiPrefix + '/address/' + this.addrStr + '/txs?limit=1000';
    this.blocks.getCurrentHeight().subscribe(height => {
      this.http.get(txurl).subscribe(
        data => {
          let apiTx: ApiCoin[] = data.json() as ApiCoin[];
          this.transactions = apiTx.map(this.txProvider.toAppCoin);
        },
        err => {
          console.error('err is', err);
          this.loading = false;
        }
      );
    });
  }
}
