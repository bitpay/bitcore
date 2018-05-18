import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { BlocksProvider } from '../../providers/blocks/blocks';

/**
 * Generated class for the BlocksPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'blocks',
  segment: 'blocks'
})
@Component({
  selector: 'page-blocks',
  templateUrl: 'blocks.html'
})
export class BlocksPage {

  public loading: boolean = true;
  public blocks: Array<any> = [];

  constructor(public navCtrl: NavController, public navParams: NavParams, private blocksProvider: BlocksProvider) {
    this.blocksProvider.getBlocks().subscribe(
      (data) => {
        this.blocks = JSON.parse(data['_body']).blocks;
        console.log('this.blocks', this.blocks);
        this.loading = false;
      },
      (err) => {
        console.log('err', err);
        this.loading = false;
      }
    );
  }
}
