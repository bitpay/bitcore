import { Component } from '@angular/core';
import { BlocksProvider } from '../../providers/blocks/blocks';

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
  public blocks: Array<any> = [];

  constructor(private blocksProvider: BlocksProvider) {
    this.text = 'Hello Latest Blocks';

    blocksProvider.getBlocks().subscribe(
      (data) => {
        this.blocks = JSON.parse(data['_body']).blocks;
        console.log('blocks', this.blocks);
      },
      (err) => {
        console.log('err', err);
      }
    );
  }

  public goToBlock(hash: string): void {
    console.log('go to', hash);
  }

  public getBlocks(num: number = 10): Array<any> {
    /* tslint:disable:no-unused-variable */
    return this.blocks.filter((block, index) => index < num);
    /* tslint:enable:no-unused-variable */
  }
}
