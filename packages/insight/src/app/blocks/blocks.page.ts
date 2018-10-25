import { Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConfigService } from '../services/config/config.service';
import { Direction, IBlock, StreamingFindOptions } from '../types/bitcore-node';

@Component({
  selector: 'app-blocks-page',
  templateUrl: 'blocks.page.html',
  styleUrls: ['blocks.page.scss']
})
export class BlocksPage {
  query$ = new BehaviorSubject<StreamingFindOptions<IBlock>>({
    limit: 100,
    direction: Direction.descending,
    paging: 'height'
  });
  constructor(public config: ConfigService) {}
}
