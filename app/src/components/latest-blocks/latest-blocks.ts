import { Component, NgZone, Input } from '@angular/core';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { NavController } from 'ionic-angular';

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
  private reloadInterval: any;

  constructor(private blocksProvider: BlocksProvider, private navCtrl: NavController, ngZone: NgZone) {
    this.loadBlocks();
    const seconds: number = 15;
    ngZone.runOutsideAngular(() => {
      this.reloadInterval = setInterval(
        function (): void {
          ngZone.run(function (): void {
            this.loadBlocks.call(this);
          }.bind(this));
        }.bind(this),
        1000 * seconds
      );
    });
  }

  private loadBlocks(): void {
    this.blocksProvider.getBlocks().subscribe(
      (data) => {
        this.blocks = JSON.parse(data['_body']).blocks;
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
    this.navCtrl.push('blocks');
  }

  private ngOnDestroy(): void {
    clearInterval(this.reloadInterval);
  }
}
