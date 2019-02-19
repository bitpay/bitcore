import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, Observable, of } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { ApiService } from '../services/api/api.service';
import { ConfigService } from '../services/config/config.service';
import { TransactionJSON } from '../types/bitcore-node';

@Component({
  selector: 'app-transaction-page',
  templateUrl: './transaction.page.html',
  styleUrls: ['./transaction.page.scss']
})
export class TransactionPage implements OnInit {
  transaction$: Observable<TransactionJSON>;

  constructor(
    public config: ConfigService,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.transaction$ = combineLatest(
      this.config.currentChain$,
      this.route.paramMap.pipe(
        switchMap(params => of(params.get('hash'))),
        filter((hash): hash is string => typeof hash === 'string')
      )
    ).pipe(
      switchMap(([chain, hash]) =>
        this.apiService.streamTransaction(chain, hash)
      )
    );
  }
}
