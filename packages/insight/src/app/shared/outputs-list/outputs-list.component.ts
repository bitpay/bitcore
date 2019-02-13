import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit
} from '@angular/core';
import * as equal from 'fast-deep-equal';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api/api.service';
import { CoinJSON, CoinListingJSON } from '../../types/bitcore-node';
import { Chain } from '../../types/chains';

@Component({
  selector: 'app-outputs-list',
  templateUrl: './outputs-list.component.html',
  styleUrls: ['./outputs-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OutputsListComponent implements OnInit {
  @Input()
  chain$: Observable<Chain>;
  @Input()
  txHash$: Observable<string>;
  @Input()
  displayValueCode = 'BCH';
  outputs$: Observable<CoinJSON[]>;

  constructor(private apiService: ApiService) {}
  ngOnInit() {
    this.outputs$ = combineLatest(this.chain$, this.txHash$).pipe(
      distinctUntilChanged(equal),
      switchMap(([chain, txHash]) =>
        this.apiService.streamTransactionCoins(chain, txHash)
      ),
      map(listing => listing.outputs),
      distinctUntilChanged(equal)
    );
  }
}
