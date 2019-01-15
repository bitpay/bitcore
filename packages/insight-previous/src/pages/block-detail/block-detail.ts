import { Component, Injectable } from '@angular/core';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { RedirProvider } from '../../providers/redir/redir';

@Injectable()

@IonicPage({
  name: 'block-detail',
  segment: ':chain/:network/block/:blockHash'
})
@Component({
  selector: 'page-block-detail',
  templateUrl: 'block-detail.html'
})
export class BlockDetailPage {
  public loading = true;
  private blockHash: string;
  public block: any = {
    tx: []
  };

  constructor(
    public navParams: NavParams,
    private blockProvider: BlocksProvider,
    private apiProvider: ApiProvider,
    public currency: CurrencyProvider,
    private logger: Logger,
    public redirProvider: RedirProvider
  ) {
    this.blockHash = navParams.get('blockHash');
    const chain: string = this.apiProvider.getConfig().chain;
    const network: string = this.apiProvider.getConfig().network;
    this.apiProvider.changeNetwork({ chain, network });
  }

  public ionViewDidLoad(): void {
    this.blockProvider.getBlock(this.blockHash).subscribe(
      data => {
        this.block = data.block;
        this.loading = false;
      },
      err => {
        this.logger.error(err);
        this.loading = false;
      }
    );
  }

  public goToPreviousBlock(): void {
    this.redirProvider.redir('block-detail', this.block.previousblockhash);
  }

  public goToNextBlock(): void {
    this.redirProvider.redir('block-detail', this.block.nextblockhash);
  }
}
