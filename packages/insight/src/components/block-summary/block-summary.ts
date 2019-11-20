import { Component, Input } from '@angular/core';
import { ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';

/**
 * Generated class for the BlockSummaryComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'block-summary',
  templateUrl: 'block-summary.html'
})
export class BlockSummaryComponent {
  @Input()
  public block: any = {};
  @Input()
  public chainNetwork: ChainNetwork;

  constructor(public currencyProvider: CurrencyProvider) {}
}
