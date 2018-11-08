import { Component, Input, OnChanges } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { Observable, of, ReplaySubject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api/api.service';
import {
  ChainDenomination,
  ChainDenominations,
  RateListing,
  Unit
} from '../../types/units';

const isDenominationChangeOnly = (code: string, displayAs: string) =>
  Object.values(ChainDenominations).some(
    denomination =>
      Object.values(denomination).some(unit => unit.code === code) &&
      Object.values(denomination).some(unit => unit.code === displayAs)
  );

const getRate = (code: string, rates: RateListing) => {
  const listing = rates.find(unit => unit.code === code);
  return listing !== undefined ? listing.rate : undefined;
};

const convertAmount = (amount: number, fromRate?: number, toRate?: number) =>
  fromRate === undefined || toRate === undefined
    ? undefined
    : (toRate / fromRate) * amount;

const getDenominationByCode = (code: string) =>
  Object.values(ChainDenominations).find(denomination =>
    Object.values(denomination).some(unit => unit.code === code)
  );

const changeDenomination = (
  amount: number,
  code: string,
  displayAs: string
) => {
  const denomination = getDenominationByCode(code);
  if (denomination === undefined) {
    return undefined;
  }
  const rates = Object.values(denomination);
  return convertAmount(amount, getRate(code, rates), getRate(displayAs, rates));
};

/**
 * The only currencies for which symbols are displayed in Insight.
 *
 * We intentionally avoid using the Angular currency pipe to display currency
 * symbols. There are potential visual edge cases with strangely-rendered,
 * uncommon currency symbols, and they simply add unnecessary visual complexity.
 *
 * We display these common symbols as people expect, and for other currencies,
 * we stick to using only currency codes.
 */
export enum CurrencySymbols {
  'USD' = '$',
  'EUR' = '€',
  'GBP' = '£',
  'CNY' = '¥'
}

interface Settings {
  amount: number;
  code: string;
  displayAs: string;
}

@Component({
  selector: 'app-currency-value',
  templateUrl: './currency-value.component.html',
  styleUrls: ['./currency-value.component.scss']
})
export class CurrencyValueComponent implements OnChanges {
  constructor(private apiService: ApiService, private logger: NGXLogger) {}
  /**
   * Note: because JavaScript uses floating point numbers for the Number type –
   * and BigInt isn't widely supported yet – this method may be imprecise with
   * non-integer amounts. (Not a problem for value estimations, but could be a
   * problem for denomination changes.)
   */
  @Input()
  amount: number;
  /**
   * The currency code/ticker symbol of the value. (E.g. when displaying a BCH
   * value from the Bitcore API, this should likely be `BCH_satoshis`, even if
   * values will be displayed in an alternative currency.)
   */
  @Input()
  code: string;
  /**
   * Either the alternative ticker/currency code, or the `ChainDenomination`
   * unit in which to display the value. (E.g. `BCH_bits`, `BCH`, `USD`, etc.)
   *
   * If an alternative ticker is provided, the value will be estimated using
   * market exchange rates.
   */
  @Input()
  displayAs: string;

  private settings = new ReplaySubject<Settings>(1);

  result$: Observable<{
    approximation?: boolean;
    unit: string;
    value?: number;
  }> = this.settings.asObservable().pipe(
    // tslint:disable-next-line:no-console
    switchMap(
      ({ amount, code, displayAs }) =>
        code === displayAs
          ? of({ value: amount, unit: code })
          : isDenominationChangeOnly(code, displayAs)
            ? of({
                value: changeDenomination(amount, code, displayAs),
                unit: displayAs
              })
            : this.apiService.streamRates.pipe(
                map((ratesListing: RateListing) => {
                  return this.convertAmountUsingRates(
                    amount,
                    code,
                    displayAs,
                    ratesListing
                  );
                })
              )
    )
  );

  ngOnChanges() {
    this.settings.next({
      amount: this.amount,
      code: this.code,
      displayAs: this.displayAs
    });
  }

  displaySymbol = (code: string) =>
    CurrencySymbols[code] ? CurrencySymbols[code] : '';

  getOrGenerateRate = (code: string, rates: RateListing) => {
    let rate = getRate(code, rates);
    if (rate === undefined) {
      const denomination = getDenominationByCode(code);
      if (denomination === undefined) {
        this.logger.error(
          `Could not get rate or denomination listing for ${code}.`
        );
        return undefined;
      }
      const primary = Object.values(denomination).find(unit => unit.rate === 1);
      if (primary === undefined) {
        this.logger.error(
          `Could not get primary denomination unit for ${code}.`
        );
        return undefined;
      }
      const from = primary.rate;
      const destination = Object.values(denomination).find(
        unit => unit.code === code
      );
      if (destination === undefined) {
        this.logger.error(
          `Could not get destination denomination unit for ${code}.`
        );
        return undefined;
      }
      const to = destination.rate;
      const primaryUnitRate = getRate(primary.code, rates);
      if (primaryUnitRate === undefined) {
        this.logger.error(
          `Could not get rate for ${code}'s primary unit: ${primary.code}.`
        );
        return undefined;
      }
      rate = convertAmount(primaryUnitRate, from, to);
    }
    return rate;
  };

  convertAmountUsingRates = (
    amount: number,
    code: string,
    displayAs: string,
    rates: RateListing
  ) => {
    return {
      unit: displayAs,
      value: convertAmount(
        amount,
        this.getOrGenerateRate(code, rates),
        this.getOrGenerateRate(displayAs, rates)
      ),
      approximation: true
    };
  };
}
