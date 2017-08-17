import { Component } from '@angular/core';

/**
 * Generated class for the LatestBlocksComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'latest-blocks',
  templateUrl: 'latest-blocks.html'
})
export class LatestBlocksComponent {

  private text: string;

  constructor() {
    console.log('Hello LatestBlocksComponent Component');
    this.text = 'Hello Latest Blocks';
  }

}
