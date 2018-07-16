import { Component, NgZone, Input } from '@angular/core';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { NavController } from 'ionic-angular';
import { CurrencyProvider } from '../../providers/currency/currency';

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
  @Input() public numBlocks: number = 10;
  @Input() public showAllBlocksButton: boolean;
  @Input() public showLoadMoreButton: boolean = false;
  @Input() public showTimeAs: string;
  private reloadInterval: any;

  constructor(
    private blocksProvider: BlocksProvider,
    private navCtrl: NavController,
    private ngZone: NgZone,
    public currency: CurrencyProvider
  ) {
  }

  public ngOnInit(): void {
    this.loadBlocks();
    const seconds: number = 15;
    this.ngZone.runOutsideAngular(() => {
      this.reloadInterval = setInterval(
        function (): void {
          this.ngZone.run(function (): void {
            this.loadBlocks.call(this);
          }.bind(this));
        }.bind(this),
        1000 * seconds
      );
    });
  }

  private loadBlocks(): void {
    this.blocksProvider.getBlocks(this.numBlocks).subscribe(
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

  public loadMoreBlocks(): void {
    clearInterval(this.reloadInterval);
    let since: number = this.blocks[this.blocks.length - 1].height;
    this.blocksProvider.pageBlocks(since, this.numBlocks).subscribe(
      ({blocks}) => {
        this.blocks = this.blocks.concat(blocks);
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
      'selectedCurrency': this.currency.selectedCurrency,
      'blockHash': blockHash
    });
  }

  public getBlocks(): Array<any> {
    return this.blocks;
    /* tslint:disable:no-unused-variable */
    // return this.blocks.filter((block, index) => index < this.numBlocks);
    /* tslint:enable:no-unused-variable */
  }

  public goToBlocks(): void {
    this.navCtrl.push('blocks', {
      'selectedCurrency': this.currency.selectedCurrency
    });
  }

  private ngOnDestroy(): void {
    clearInterval(this.reloadInterval);
  }
}
