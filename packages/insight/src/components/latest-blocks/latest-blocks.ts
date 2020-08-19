import { Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChainNetwork } from '../../providers/api/api';
import {
  ApiEthBlock,
  ApiUtxoCoinBlock,
  AppBlock,
  BlocksProvider
} from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { DefaultProvider } from '../../providers/default/default';
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
  public isHomePage = false;
  @Input()
  public showTimeAs: string;
  @Input()
  public chainNetwork: ChainNetwork;
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
    private ngZone: NgZone
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
    if (this.chainNetwork.chain !== 'ALL') {
      this.subscriber = this.blocksProvider
        .getBlocks(this.chainNetwork, this.numBlocks)
        .subscribe(
          response => {
            const blocks = response.map(
              (block: ApiEthBlock & ApiUtxoCoinBlock) => {
                if (
                  this.chainNetwork.chain === 'BTC' ||
                  this.chainNetwork.chain === 'BCH'
                ) {
                  return this.blocksProvider.toUtxoCoinAppBlock(block);
                }
                if (this.chainNetwork.chain === 'ETH') {
                  return this.blocksProvider.toEthAppBlock(block);
                }
              }
            );
            this.blocks = blocks;
            this.loading = false;
            if (this.blocks[this.blocks.length - 1].height < this.numBlocks) {
              this.isHomePage = false;
            }
          },
          err => {
            this.subscriber.unsubscribe();
            clearInterval(this.reloadInterval);
            this.errorMessage = err;
            this.loading = false;
          }
        );
    }
  }

  public loadMoreBlocks(infiniteScroll) {
    clearInterval(this.reloadInterval);
    const since: number =
      this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].height : 0;
    return this.blocksProvider
      .pageBlocks(since, this.numBlocks, this.chainNetwork)
      .subscribe(
        response => {
          const blocks = response.map(
            (block: ApiEthBlock & ApiUtxoCoinBlock) => {
              if (
                this.chainNetwork.chain === 'BTC' ||
                this.chainNetwork.chain === 'BCH'
              ) {
                return this.blocksProvider.toUtxoCoinAppBlock(block);
              }
              if (this.chainNetwork.chain === 'ETH') {
                return this.blocksProvider.toEthAppBlock(block);
              }
            }
          );
          this.blocks = this.blocks.concat(blocks);
          this.loading = false;
          infiniteScroll.complete();
        },
        err => {
          this.errorMessage = err.message;
          this.loading = false;
        }
      );
  }

  public goToBlock(blockHash: string): void {
    this.redirProvider.redir('block-detail', {
      blockHash,
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    });
  }

  public goToBlocks(): void {
    this.redirProvider.redir('blocks', {
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
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
