import { Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConfigService } from '../services/config/config.service';
import {
  Direction,
  SpentHeightIndicators,
  StreamingFindOptions,
  TransactionJSON
} from '../types/bitcore-node';

@Component({
  selector: 'app-transactions-page',
  templateUrl: 'transactions.page.html',
  styleUrls: ['transactions.page.scss']
})
export class TransactionsPage {
  query$ = new BehaviorSubject<
    StreamingFindOptions<TransactionJSON> & {
      blockHeight?: number;
      blockHash?: string;
    }
  >({
    blockHeight: SpentHeightIndicators.pending,
    limit: 20,
    direction: Direction.descending,
    paging: 'blockTimeNormalized'
  });
  constructor(public config: ConfigService) {}
}
