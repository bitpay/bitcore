import { Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiProvider } from '../../providers/api/api';
import { AppBlock, BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { DefaultProvider } from '../../providers/default/default';
import { Logger } from '../../providers/logger/logger';
import { RedirProvider } from '../../providers/redir/redir';

@Component({
  selector: 'latest-blocks',
  templateUrl: 'latest-blocks.html'
})
export class LatestBlocksComponent implements OnInit, OnDestroy {
  @Input()
  public numBlocks: number;
  @Input()
  public showAllBlocksButton = false;
  @Input()
  public showLoadMoreButton = false;
  @Input()
  public showTimeAs: string;
  public loading = true;
  public blocks: AppBlock[] = [];
  public subscriber: Subscription;
  public errorMessage: string;

  private reloadInterval: any;

  constructor(
    public currency: CurrencyProvider,
    public defaults: DefaultProvider,
    public redirProvider: RedirProvider,
    private blocksProvider: BlocksProvider,
    private apiProvider: ApiProvider,
    private ngZone: NgZone,
    private logger: Logger
  ) {
    this.numBlocks = parseInt(defaults.getDefault('%NUM_BLOCKS%'), 10);
  }

  public ngOnInit(): void {
    this.loadBlocks();
    const seconds = 15;
    this.ngZone.runOutsideAngular(() => {
      this.reloadInterval = setInterval(() => {
        this.ngZone.run(() => {
          this.loadBlocks.call(this);
        });
      }, 1000 * seconds);
    });
  }

  private loadBlocks(): void {
    this.subscriber = this.blocksProvider.getBlocks(this.numBlocks).subscribe(
      response => {
        const blocks = response.map(block =>
          this.blocksProvider.toAppBlock(block)
        );
        this.blocks = blocks;
        this.loading = false;
      },
      err => {
        this.subscriber.unsubscribe();
        clearInterval(this.reloadInterval);
        this.logger.error(err.message);
        this.errorMessage = err.message;
        this.loading = false;
      }
    );
  }

  public loadMoreBlocks(infiniteScroll) {
    clearInterval(this.reloadInterval);
    const since: number =
      this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].height : 0;
    return this.blocksProvider.pageBlocks(since, this.numBlocks).subscribe(
      response => {
        const blocks = response.map(block =>
          this.blocksProvider.toAppBlock(block)
        );
        this.blocks = this.blocks.concat(blocks);
        this.loading = false;
        infiniteScroll.complete();
      },
      err => {
        this.logger.error(err.message);
        this.errorMessage = err.message;
        this.loading = false;
      }
    );
  }

  public goToBlock(blockHash: string): void {
    this.redirProvider.redir('block-detail', {
      blockHash,
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    });
  }

  public goToBlocks(): void {
    this.redirProvider.redir('blocks', {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    });
  }

  public reloadData() {
    this.subscriber.unsubscribe();
    this.blocks = [];
    this.ngOnInit();
  }

  public ngOnDestroy(): void {
    clearInterval(this.reloadInterval);
  }
}
