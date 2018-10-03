import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit
} from '@angular/core';
import * as equal from 'fast-deep-equal';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../services/api/api.service';
import { IBlock, StreamingFindOptions } from '../../types/bitcore-node';
import { Chain } from '../../types/configuration';

@Component({
  selector: 'app-block-list',
  templateUrl: './block-list.component.html',
  styleUrls: ['./block-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlockListComponent implements OnInit {
  @Input()
  chain: Observable<Chain>;
  @Input()
  query: Observable<StreamingFindOptions<IBlock>>;
  @Input()
  displayValueIn = 'BCH';
  block$: Observable<IBlock>;

  constructor(private apiService: ApiService) {}
  ngOnInit() {
    this.block$ = combineLatest(this.chain, this.query).pipe(
      distinctUntilChanged((x, y) => equal(x, y)),
      switchMap(([chain, query]) => this.apiService.streamBlocks(chain, query)),
      distinctUntilChanged((x, y) => equal(x, y))
    );
  }

  goToBlock(block: IBlock) {
    // tslint:disable-next-line:no-console
    console.log('TODO: navigate to block', block.hash);
  }
}
