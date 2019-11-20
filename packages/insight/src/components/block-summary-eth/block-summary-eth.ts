import { Component, Input } from '@angular/core';
import { ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';

/**
 * Generated class for the BlockSummaryEthComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'block-summary-eth',
  templateUrl: 'block-summary-eth.html'
})
export class BlockSummaryEthComponent {
  @Input()
  public block: any = {};
  @Input()
  public chainNetwork: ChainNetwork;

  constructor(public currencyProvider: CurrencyProvider) {}
}
