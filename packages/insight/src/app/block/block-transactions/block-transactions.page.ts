import { Component, OnInit } from '@angular/core';
import { toObservable } from '@angular/forms/src/validators';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, from, Subject } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { ApiService } from '../../services/api/api.service';
import { ConfigService } from '../../services/config/config.service';
import {
  Direction,
  StreamingFindOptions,
  TransactionJSON
} from '../../types/bitcore-node';

@Component({
  selector: 'app-block-transactions-page',
  templateUrl: 'block-transactions.page.html',
  styleUrls: ['block-transactions.page.scss']
})
export class BlockTransactionsPage implements OnInit {
  private _query$: Subject<
    StreamingFindOptions<TransactionJSON> & {
      blockHeight?: number;
      blockHash?: string;
    }
  > = new Subject();
  query$ = this._query$.asObservable();

  hash = this.route.params
    .pipe(
      take(1),
      map(param => param['hash'])
    )
    .toPromise() as Promise<string>;

  block$ = combineLatest(from(this.hash), this.config.currentChain$).pipe(
    switchMap(([hash, chain]) => this.apiService.streamBlock(chain, hash))
  );

  constructor(
    public config: ConfigService,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}
  ngOnInit() {
    this.hash.then(hash => {
      this._query$.next({
        blockHash: hash,
        limit: 20,
        direction: Direction.ascending,
        paging: 'txid'
      });
    });
  }
}
