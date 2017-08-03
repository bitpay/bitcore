import { Component } from '@angular/core';

/**
 * Generated class for the TransactionComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'transaction',
  templateUrl: 'transaction.html'
})
export class TransactionComponent {

  text: string;

  constructor() {
    console.log('Hello TransactionComponent Component');
    this.text = 'Hello World';
  }

}
