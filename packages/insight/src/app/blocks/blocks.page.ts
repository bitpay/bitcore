import { Component, OnInit } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-blocks',
  templateUrl: 'blocks.page.html',
  styleUrls: ['blocks.page.scss']
})
export class BlocksPage implements OnInit {
  chain$ = new BehaviorSubject({ ticker: 'BTC', network: 'mainnet' });
  query$ = new BehaviorSubject({});

  constructor() {
    this.chain$.subscribe(value =>
      // tslint:disable-next-line:no-console
      console.log(`Chain value: ${JSON.stringify(value)}`)
    );
  }

  ngOnInit() {
    interval(1 * 1000)
      .pipe(take(1))
      .subscribe(() => {
        // tslint:disable-next-line:no-console
        console.log('Simulating chain switch to BCH:');
        this.chain$.next({ ticker: 'BCH', network: 'mainnet' });
      });
  }
}
