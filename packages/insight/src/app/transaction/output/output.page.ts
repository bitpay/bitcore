import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, from, Observable, of } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api/api.service';
import { ConfigService } from '../../services/config/config.service';
import { CoinJSON } from '../../types/bitcore-node';

@Component({
  selector: 'app-output-page',
  templateUrl: 'output.page.html',
  styleUrls: ['output.page.scss']
})
export class OutputPage implements OnInit {
  coin$: Observable<CoinJSON>;

  constructor(
    public config: ConfigService,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.coin$ = combineLatest(
      this.config.currentChain$,
      this.route.paramMap.pipe(
        switchMap(params => of([params.get('hash'), params.get('output')])),
        filter<[string, string]>(
          ([hash, output]) => hash !== null && output !== null
        )
      )
    ).pipe(
      switchMap(([chain, [hash, index]]) =>
        this.apiService
          .streamTransactionCoins(chain, hash)
          .pipe(map(listing => listing.outputs[index]))
      )
    );
  }
}
