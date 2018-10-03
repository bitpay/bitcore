import { Component, Input, OnChanges } from '@angular/core';
import { ApiService } from '../../services/api/api.service';

@Component({
  selector: 'app-currency-value',
  templateUrl: './currency-value.component.html',
  styleUrls: ['./currency-value.component.scss']
})
export class CurrencyValueComponent implements OnChanges {
  /**
   * The currency value in the smallest unit accounted for by Insight. (E.g.
   * for BCH, the atomic unit is satoshis.)
   */
  @Input()
  inAtomicUnits: number;
  /**
   * The currency code/ticker symbol of the value. (E.g. when displaying BCH
   * values, this should always be `BCH`, even if values will be displayed in an
   * alternative currency.)
   */
  @Input()
  ticker: string;
  /**
   * Either the alternative ticker/currency code, or the unit (e.g. satoshis,
   * bits, BCH) in which to display the value.
   *
   * If an alternative ticker is provided, the value will be estimated using
   * market exchange rates.
   */
  @Input()
  displayAs: string;

  constructor(private apiService: ApiService) {}
  ngOnChanges() {}
}
