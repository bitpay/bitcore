import { Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiProvider } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { DefaultProvider } from '../../providers/default/default';
import { Logger } from '../../providers/logger/logger';
import { RedirProvider } from '../../providers/redir/redir';

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
  public errorMessage: string;

  constructor(
    private blocksProvider: BlocksProvider,
    private apiProvider: ApiProvider,
    private ngZone: NgZone,
    public currency: CurrencyProvider,
    public defaults: DefaultProvider,
    private logger: Logger,
    public redirProvider: RedirProvider
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
      ({ blocks }) => {
        this.blocks = blocks;
        this.loading = false;
      },
      err => {
        this.subscriber.unsubscribe();
        clearInterval(this.reloadInterval);
        this.logger.error(err._body);
        this.errorMessage = err;
        this.loading = false;
      }
    );
  }

  public loadMoreBlocks(infiniteScroll) {
    clearInterval(this.reloadInterval);
    const since: number =
      this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].height : 0;
    return this.blocksProvider.pageBlocks(since, this.numBlocks).subscribe(
      ({ blocks }) => {
        this.blocks = this.blocks.concat(blocks);
        this.loading = false;
        infiniteScroll.complete();
      },
      err => {
        this.logger.error(err);
        this.errorMessage = err;
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

  public getBlocks(): any[] {
    return this.blocks;
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
