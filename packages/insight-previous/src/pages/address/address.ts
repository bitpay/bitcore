import { Component, Injectable } from '@angular/core';
import { Events, IonicPage, NavParams } from 'ionic-angular';
import { AddressProvider } from '../../providers/address/address';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { PriceProvider } from '../../providers/price/price';
import { TxsProvider } from '../../providers/transactions/transactions';

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
  public address: any = {};
  public nroTransactions = 0;
  public errorMessage: string;

  private addrStr: string;
  private chainNetwork: ChainNetwork;

  constructor(
    public navParams: NavParams,
    public currencyProvider: CurrencyProvider,
    private apiProvider: ApiProvider,
    public txProvider: TxsProvider,
    private logger: Logger,
    private priceProvider: PriceProvider,
    private addrProvider: AddressProvider,
    private events: Events
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
    this.currencyProvider.setCurrency();
    this.priceProvider.setCurrency();

    this.events.subscribe('CoinList', (d: any) => {
      this.nroTransactions = d.length;
    });
  }

  public ionViewWillLoad(): void {
    this.addrProvider.getAddressBalance(this.addrStr).subscribe(
      data => {
        this.address = {
          balance: data.balance || 0,
          confirmed: data.confirmed || 0,
          unconfirmed: data.unconfirmed,
          addrStr: this.addrStr
        };
        this.loading = false;
      },
      err => {
        this.logger.error(err.message);
        this.errorMessage = err.message;
        this.loading = false;
      }
    );
  }

  public getConvertedNumber(n: number): number {
    return this.currencyProvider.getConvertedNumber(n);
  }
}
