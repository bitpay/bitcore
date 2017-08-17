import { Component } from '@angular/core';

/**
 * Generated class for the LatestTransactionsComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'latest-transactions',
  templateUrl: 'latest-transactions.html'
})
export class LatestTransactionsComponent {

  private text: string;

  constructor() {
    console.log('Hello LatestTransactionsComponent Component');
    this.text = 'Hello Latest Transactions';
  }

}
