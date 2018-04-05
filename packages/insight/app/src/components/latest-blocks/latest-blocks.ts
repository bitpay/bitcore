import { Component, NgZone, Input } from '@angular/core';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { NavController } from 'ionic-angular';
import { BlocksPage } from '../../pages';

/**
 * Generated class for the LatestBlocksComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'latest-blocks',
  templateUrl: 'latest-blocks.html'
})
export class LatestBlocksComponent {

  public loading: boolean = true;
  public blocks: Array<any> = [];
  @Input() public numBlocks: number;
  @Input() public showAllBlocksButton: boolean;
  @Input() public showTimeAs: string;

  constructor(private blocksProvider: BlocksProvider, private navCtrl: NavController, ngZone: NgZone) {
    this.loadBlocks();
    ngZone.runOutsideAngular(() => {
      setInterval(
        function (): void {
          ngZone.run(function (): void {
            this.loadBlocks.call(this);
          }.bind(this));
        }.bind(this),
        1000 * 30
      );
    });
  }

  private loadBlocks(): void {
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

  public goToBlock(blockHash: string): void {
    this.navCtrl.push('block-detail', {
      'blockHash': blockHash
    });
  }

  public getBlocks(): Array<any> {
    /* tslint:disable:no-unused-variable */
    return this.blocks.filter((block, index) => index < this.numBlocks);
    /* tslint:enable:no-unused-variable */
  }

  public goToBlocks(): void {
    this.navCtrl.push(BlocksPage);
  }
}
