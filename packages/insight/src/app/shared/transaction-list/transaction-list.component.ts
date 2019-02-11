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
import {
  StreamingFindOptions,
  TransactionJSON
} from '../../types/bitcore-node';
import { Chain } from '../../types/chains';

@Component({
  selector: 'app-transaction-list',
  templateUrl: './transaction-list.component.html',
  styleUrls: ['./transaction-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionListComponent implements OnInit {
  @Input()
  chain$: Observable<Chain>;
  @Input()
  query$: Observable<StreamingFindOptions<TransactionJSON>>;
  @Input()
  displayValueCode = 'BCH';
  transactions$: Observable<TransactionJSON>;

  constructor(private apiService: ApiService) {}
  ngOnInit() {
    this.transactions$ = combineLatest(this.chain$, this.query$).pipe(
      distinctUntilChanged(equal),
      switchMap(([chain, query]) =>
        this.apiService.streamTransactions(chain, query)
      ),
      distinctUntilChanged(equal)
    );
  }
}
