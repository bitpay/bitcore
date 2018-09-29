import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ApiService } from '../../services/api/api.service';
import { IBlock } from '../../types/bitcore-node';
import { Network, Ticker } from '../../types/configuration';

@Component({
  selector: 'app-block-list',
  templateUrl: './block-list.component.html',
  styleUrls: ['./block-list.component.scss']
})
export class BlockListComponent {
  @Input()
  public ticker: Ticker;
  @Input()
  public network: Network;
  @Input()
  public blocks: number;
  @Input()
  public paging: keyof IBlock = 'height';

  public blockStream = this.apiService.streamBlocks(
    { ticker: this.ticker, network: this.network },
    {
      paging: this.paging
    }
  );

  constructor(private apiService: ApiService) {}
}
