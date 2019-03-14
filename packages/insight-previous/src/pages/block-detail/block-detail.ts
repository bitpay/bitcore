import { Component, Injectable } from '@angular/core';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { PriceProvider } from '../../providers/price/price';
import { RedirProvider } from '../../providers/redir/redir';
import { TxsProvider } from '../../providers/transactions/transactions';

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
  private blockHash: string;
  private chainNetwork: ChainNetwork;

  public loading = true;
  public errorMessage: string;
  public confirmations: number;
  public block: any = {
    tx: []
  };

  constructor(
    public navParams: NavParams,
    public currencyProvider: CurrencyProvider,
    public redirProvider: RedirProvider,
    public txProvider: TxsProvider,
    private blockProvider: BlocksProvider,
    private logger: Logger,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider
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
        this.txProvider
          .getConfirmations(this.block.height)
          .subscribe(confirmations => (this.confirmations = confirmations));
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
