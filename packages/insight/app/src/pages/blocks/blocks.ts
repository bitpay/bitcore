import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { DefaultProvider } from '../../providers/default/default';

/**
 * Generated class for the BlocksPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'blocks',
  segment: ':selectedCurrency/blocks'
})
@Component({
  selector: 'page-blocks',
  templateUrl: 'blocks.html'
})
export class BlocksPage {

  public loading: boolean = true;
  public blocks: Array<any> = [];

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private blocksProvider: BlocksProvider,
    public defaults: DefaultProvider
  ) {
    this.blocksProvider.getBlocks().subscribe(
      ({blocks}) => {
        this.blocks = blocks;
        this.loading = false;
      },
      (err) => {
        console.log('err', err);
        this.loading = false;
      }
    );
  }
}
