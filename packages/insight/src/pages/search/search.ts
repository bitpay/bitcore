import { Component, Injectable } from '@angular/core';
import { Events, IonicPage, NavParams } from 'ionic-angular';
import * as _ from 'lodash';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { PriceProvider } from '../../providers/price/price';
import { RedirProvider } from '../../providers/redir/redir';

@Injectable()
@IonicPage({
  name: 'search',
  segment: ':chain/:network/search'
})
@Component({
  selector: 'page-search',
  templateUrl: 'search.html'
})
export class SearchPage {
  public chain: string;
  public chainNetwork: ChainNetwork;
  public network: string;
  public availableNetworks;
  public matches;
  constructor(
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider,
    public events: Events,
    public currencyProvider: CurrencyProvider,
    public redirProvider: RedirProvider
  ) {
    const chain: string =
      this.navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      this.navParams.get('network') || this.apiProvider.getConfig().network;
    this.matches = this.navParams.get('matches');

    this.chainNetwork = {
      chain,
      network
    };

    this.priceProvider.setCurrency();
    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency(this.chainNetwork);
  }

  public goToBlock(block: any): void {
    this.redirProvider.redir('block-detail', {
      blockHash: block.hash,
      chain: block.chain,
      network: block.network
    });
  }

  public goToTx(tx): void {
    this.redirProvider.redir('transaction', {
      txId: tx.txid,
      chain: tx.chain,
      network: tx.network
    });
  }

  public goToAddress(addr): void {
    this.redirProvider.redir('address', {
      addrStr: addr.address,
      chain: addr.chain,
      network: addr.network
    });
  }
}
