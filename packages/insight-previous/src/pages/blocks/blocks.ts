import { Component, Injectable } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Logger } from '../../providers/logger/logger';
import { ApiProvider } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';

@Injectable()

@IonicPage({
  name: 'blocks',
  segment: ':chain/:network/blocks'
})
@Component({
  selector: 'page-blocks',
  templateUrl: 'blocks.html'
})
export class BlocksPage {
  public loading = true;
  public blocks: any[] = [];

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private blocksProvider: BlocksProvider,
    private logger: Logger
  ) {
    const chain: string = navParams.get('chain');
    const network: string = navParams.get('network');
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
