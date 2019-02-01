import { Component, Injectable } from '@angular/core';
import { IonicPage, NavParams } from 'ionic-angular';
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
  private addrStr: string;
  private chainNetwork: ChainNetwork;
  public address: any = {};

  constructor(
    public navParams: NavParams,
    public currencyProvider: CurrencyProvider,
    private apiProvider: ApiProvider,
    public txProvider: TxsProvider,
    private logger: Logger,
    private priceProvider: PriceProvider,
    private addrProvider: AddressProvider
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
    this.addrProvider.getAddressBalance(this.addrStr).subscribe(
      data => {
        this.address = {
          balance: data.balance,
          confirmed: data.confirmed,
          unconfirmed: data.unconfirmed,
          addrStr: this.addrStr
        };
        this.loading = false;
      },
      err => {
        this.logger.error(err);
      }
    );
  }

  public getBalance(): number {
    return this.currencyProvider.getConvertedNumber(this.address.balance);
  }

  public getConfirmedBalance(): number {
    return this.currencyProvider.getConvertedNumber(this.address.confirmed);
  }

  public getUnconfirmedBalance(): number {
    return this.currencyProvider.getConvertedNumber(this.address.unconfirmed);
  }
}
