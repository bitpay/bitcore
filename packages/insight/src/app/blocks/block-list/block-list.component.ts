import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit
} from '@angular/core';
import * as equal from 'fast-deep-equal';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api/api.service';
import { IBlock, StreamingFindOptions } from '../../types/bitcore-node';
import { Chain } from '../../types/chains';

@Component({
  selector: 'app-block-list',
  templateUrl: './block-list.component.html',
  styleUrls: ['./block-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlockListComponent implements OnInit {
  @Input()
  chain$: Observable<Chain>;
  @Input()
  query$: Observable<StreamingFindOptions<IBlock>>;
  @Input()
  displayValueCode = 'BCH';
  blocks$: Observable<IBlock>;

  constructor(private apiService: ApiService) {}
  ngOnInit() {
    this.blocks$ = combineLatest(this.chain$, this.query$).pipe(
      distinctUntilChanged(equal),
      switchMap(([chain, query]) => this.apiService.streamBlocks(chain, query)),
      distinctUntilChanged(equal)
    );
  }
}
