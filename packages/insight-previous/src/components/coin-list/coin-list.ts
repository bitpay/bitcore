import { Component, Input } from '@angular/core';
import { AppCoin } from '../../providers/transactions/transactions';

/**
 * Generated class for the CoinListComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'coin-list',
  templateUrl: 'coin-list.html'
})
export class CoinListComponent {
  @Input() public coins: [AppCoin];
}
