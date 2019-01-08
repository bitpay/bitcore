import { Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Subscription } from 'rxjs';
import { ApiProvider } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { DefaultProvider } from '../../providers/default/default';

@Component({
  selector: 'latest-blocks',
  templateUrl: 'latest-blocks.html'
})
export class LatestBlocksComponent implements OnInit, OnDestroy {
  public loading = true;
  public blocks: any[] = [];
  @Input()
  public numBlocks: number;
  @Input()
  public showAllBlocksButton = false;
  @Input()
  public showLoadMoreButton = false;
  @Input()
  public showTimeAs: string;
  private reloadInterval: any;

  public subscriber: Subscription;

  constructor(
    private blocksProvider: BlocksProvider,
    private apiProvider: ApiProvider,
    private navCtrl: NavController,
    private ngZone: NgZone,
    public currency: CurrencyProvider,
    public defaults: DefaultProvider
  ) {
    this.numBlocks = parseInt(defaults.getDefault('%NUM_BLOCKS%'), 10);
  }

  public ngOnInit(): void {
    this.loadBlocks();
    const seconds = 15;
    this.ngZone.runOutsideAngular(() => {
      this.reloadInterval = setInterval(
        function (): void {
          this.ngZone.run(
            function (): void {
              this.loadBlocks.call(this);
            }.bind(this)
          );
        }.bind(this),
        1000 * seconds
      );
    });
  }

  private loadBlocks(): void {
    this.subscriber = this.blocksProvider.getBlocks(this.numBlocks).subscribe(
      ({ blocks }) => {
        this.blocks = blocks;
        this.loading = false;
      },
      err => {
        console.log('err', err);
        this.loading = false;
      }
    );
  }

  public loadMoreBlocks(): void {
    clearInterval(this.reloadInterval);
    const since: number = this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].height : 0;
    this.blocksProvider.pageBlocks(since, this.numBlocks).subscribe(
      ({ blocks }) => {
        this.blocks = this.blocks.concat(blocks);
        this.loading = false;
      },
      err => {
        console.log('err', err);
        this.loading = false;
      }
    );
  }

  public goToBlock(blockHash: string): void {
    this.navCtrl.push('block-detail', {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network,
      blockHash
    });
  }

  public getBlocks(): any[] {
    return this.blocks;
  }

  public goToBlocks(): void {
    this.navCtrl.push('blocks', {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    });
  }

  public reloadData() {
    this.subscriber.unsubscribe();
    this.blocks = [];
    this.ngOnInit();
  }

  ngOnDestroy(): void {
    clearInterval(this.reloadInterval);
  }
}
