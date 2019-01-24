import { Component, Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { PriceProvider } from '../../providers/price/price';
import {
  ApiCoin,
  TxsProvider
} from '../../providers/transactions/transactions';

@Injectable()
@IonicPage({
  name: 'address',
  segment: ':chain/:network/address/:addrStr',
  defaultHistory: ['home']
})
@Component({
  selector: 'page-address',
  templateUrl: 'address.html'
})
export class AddressPage {
  public loading = true;
  private addrStr: string;
  private chainNetwork: ChainNetwork;
  public address: any = {};
  public transactions: any[] = [];
  public showTransactions: boolean;

  constructor(
    public navParams: NavParams,
    private http: Http,
    public currencyProvider: CurrencyProvider,
    private apiProvider: ApiProvider,
    public txProvider: TxsProvider,
    private logger: Logger,
    private priceProvider: PriceProvider
  ) {
    this.addrStr = navParams.get('addrStr');

    const chain: string =
      navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      navParams.get('network') || this.apiProvider.getConfig().network;

    this.chainNetwork = {
      chain,
      network
    };
    this.apiProvider.changeNetwork(this.chainNetwork);
    this.priceProvider.setCurrency(this.chainNetwork.chain);
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
        this.logger.error(err);
      }
    );

    const txurl: string =
      this.apiProvider.getUrl() +
      '/address/' +
      this.addrStr +
      '/txs?limit=1000';
    this.http.get(txurl).subscribe(
      data => {
        const apiTx: ApiCoin[] = data.json() as ApiCoin[];
        this.transactions = apiTx.map(this.txProvider.toAppCoin);
        this.showTransactions = true;
      },
      err => {
        this.logger.error(err);
        this.loading = false;
        this.showTransactions = false;
      }
    );
  }

  public getBalance(): number {
    return this.currencyProvider.getConvertedNumber(this.address.balance);
  }
}
