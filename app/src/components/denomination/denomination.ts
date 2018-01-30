import { Component } from '@angular/core';

/**
 * Generated class for the DenominationComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'denomination',
  templateUrl: 'denomination.html'
})
export class DenominationComponent {

  public text: string;

  constructor() {
    console.log('Hello DenominationComponent Component');
    this.text = 'Hello World';
  }

}
