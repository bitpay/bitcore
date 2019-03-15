import { Component, Injectable } from '@angular/core';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { PriceProvider } from '../../providers/price/price';
import { RedirProvider } from '../../providers/redir/redir';

@Injectable()
@IonicPage({
  name: 'block-detail',
  segment: ':chain/:network/block/:blockHash',
  defaultHistory: ['home']
})
@Component({
  selector: 'page-block-detail',
  templateUrl: 'block-detail.html'
})
export class BlockDetailPage {
  public loading = true;
  private blockHash: string;
  private chainNetwork: ChainNetwork;
  public block: any = {
    tx: []
  };
  public errorMessage: string;

  constructor(
    public navParams: NavParams,
    private blockProvider: BlocksProvider,
    private apiProvider: ApiProvider,
    public currencyProvider: CurrencyProvider,
    private logger: Logger,
    private priceProvider: PriceProvider,
    public redirProvider: RedirProvider
  ) {
    this.blockHash = navParams.get('blockHash');
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
  }

  ionViewDidLoad() {
    this.blockProvider.getBlock(this.blockHash).subscribe(
      data => {
        this.block = data.block;
        this.loading = false;
      },
      err => {
        this.logger.error(err);
        this.errorMessage = err;
        this.loading = false;
      }
    );
  }

  public goToPreviousBlock(): void {
    this.redirProvider.redir('block-detail', {
      blockHash: this.block.previousblockhash,
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    });
  }

  public goToNextBlock(): void {
    this.redirProvider.redir('block-detail', {
      blockHash: this.block.nextblockhash,
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    });
  }
}
