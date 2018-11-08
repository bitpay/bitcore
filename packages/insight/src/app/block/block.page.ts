import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, Observable, of } from 'rxjs';
import { filter, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../services/api/api.service';
import { ConfigService } from '../services/config/config.service';
import { IBlock } from '../types/bitcore-node';

@Component({
  selector: 'app-block-page',
  templateUrl: './block.page.html',
  styleUrls: ['./block.page.scss']
})
export class BlockPage implements OnInit {
  block$: Observable<IBlock>;

  constructor(
    public config: ConfigService,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.block$ = combineLatest(
      this.config.currentChain$,
      this.route.paramMap.pipe(
        switchMap(params => of(params.get('hash'))),
        filter((hash): hash is string => typeof hash === 'string')
      )
    ).pipe(
      switchMap(([chain, hash]) => this.apiService.streamBlock(chain, hash))
    );
  }
}
