import { Component, Input } from '@angular/core';
import { switchMap, take } from 'rxjs/operators';
import { ApiService } from '../../services/api/api.service';
import { ConfigService } from '../../services/config/config.service';
import {
  SpentHeightIndicators,
  TransactionJSON
} from '../../types/bitcore-node';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss']
})
export class TransactionComponent {
  @Input()
  transaction: TransactionJSON;

  pending = SpentHeightIndicators.pending;
  conflicting = SpentHeightIndicators.conflicting;

  /**
   * The unit in which to display value – can be either a valid denomination for
   * this chain or an alternative currency in which to estimate value.
   */
  @Input()
  displayValueCode: string;

  @Input()
  summary = true;

  authhead$ = this.config.currentChain$.pipe(
    take(1),
    switchMap(chain =>
      this.apiService.streamTransactionAuthhead(chain, this.transaction.txid)
    )
  );
  constructor(private config: ConfigService, private apiService: ApiService) {}
}
