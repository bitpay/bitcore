import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation
} from '@angular/core';
import * as equal from 'fast-deep-equal';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../services/api/api.service';
import { ConfigService } from '../services/config/config.service';
import { DailyTransactionsJSON } from '../types/bitcore-node';

type Ranges = 'lastMonth' | 'last3Months' | 'lastYear' | 'all';
type RangeUnit = 'Daily' | 'Weekly' | 'Monthly';

const aggregateTransactions = (
  period: number,
  data: Array<{
    name: Date;
    value: number;
  }>
) => {
  const result: Array<{
    name: Date;
    value: number;
  }> = [];
  let currentPeriod: Array<{
    name: Date;
    value: number;
  }> = [];
  for (const day of data) {
    if (currentPeriod.length > period) {
      result.push({
        name: currentPeriod[0].name,
        value: currentPeriod.reduce((sum, d) => sum + d.value, 0)
      });
      currentPeriod = [];
    }
    currentPeriod.push(day);
  }
  return result;
};
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  // tslint:disable-next-line:use-view-encapsulation (to target ngx-charts)
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {
  dailyTransactions$ = this.config.currentChain$.pipe(
    distinctUntilChanged(equal),
    switchMap(chain => this.apiService.streamStatsDailyTransactions(chain)),
    distinctUntilChanged(equal),
    map((response: DailyTransactionsJSON) =>
      response.results
        .map(day => {
          const [YYYY, mm, dd] = day.date.split('-');
          const date = new Date(
            // TODO: just send time down in ISO format
            Date.UTC(parseInt(YYYY, 10), parseInt(mm, 10), parseInt(dd, 10))
          );
          return {
            name: date,
            value: day.transactionCount
          };
        })
        .sort((a, b) => a.name.getTime() - b.name.getTime())
    ),
    map(sortedData => {
      const projected: { [range in Ranges]: typeof sortedData } = {
        all: aggregateTransactions(30, sortedData),
        lastYear: aggregateTransactions(7, sortedData.slice(-365)),
        last3Months: sortedData.slice(-90),
        lastMonth: sortedData.slice(-30)
      };
      return projected;
    })
  );

  dailyTransactionsBarColor = {
    domain: ['#657fe5']
  };
  transactionsRange: Ranges;
  barPadding: number;
  rangeUnit: RangeUnit;

  constructor(public config: ConfigService, private apiService: ApiService) {
    this.config.setTitle(
      `Insight ${config.currentChain$.getValue().code} Block Explorer`
    );
    this.show3M();
  }

  show1M() {
    this.transactionsRange = 'lastMonth';
    this.barPadding = 20;
    this.rangeUnit = 'Daily';
  }
  show3M() {
    this.transactionsRange = 'last3Months';
    this.barPadding = 4;
    this.rangeUnit = 'Daily';
  }
  show1Y() {
    this.transactionsRange = 'lastYear';
    this.barPadding = 8;
    this.rangeUnit = 'Weekly';
  }
  showAll() {
    this.transactionsRange = 'all';
    this.barPadding = 4;
    this.rangeUnit = 'Monthly';
  }

  clickedDay(event) {
    // tslint:disable-next-line:no-console
    console.log(event);
  }
}
