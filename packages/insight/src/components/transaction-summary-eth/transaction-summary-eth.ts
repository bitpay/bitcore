import { Component, Input } from '@angular/core';
import { ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';

/**
 * Generated class for the TransactionSummaryEthComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'transaction-summary-eth',
  templateUrl: 'transaction-summary-eth.html'
})
export class TransactionSummaryEthComponent {
  @Input()
  public tx: any = {};
  @Input()
  public chainNetwork: ChainNetwork;

  constructor(public currencyProvider: CurrencyProvider) {}
}
