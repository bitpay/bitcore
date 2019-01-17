import { Component, Injectable } from '@angular/core';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { Logger } from '../../providers/logger/logger';

@Injectable()
@IonicPage({
  name: 'blocks',
  segment: ':chain/:network/blocks',
  defaultHistory: ['home']
})
@Component({
  selector: 'page-blocks',
  templateUrl: 'blocks.html'
})
export class BlocksPage {
  public loading = true;
  public blocks: any[] = [];

  constructor(
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private blocksProvider: BlocksProvider,
    private logger: Logger
  ) {
    const chain: string = this.apiProvider.getConfig().chain;
    const network: string = this.apiProvider.getConfig().network;
    this.apiProvider.changeNetwork({ chain, network });

    this.blocksProvider.getBlocks().subscribe(
      ({ blocks }) => {
        this.blocks = blocks;
        this.loading = false;
      },
      err => {
        this.logger.error(err);
        this.loading = false;
      }
    );
  }
}
