import { Component, Input } from '@angular/core';
import { IBlock } from '../../types/bitcore-node';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss']
})
export class BlockComponent {
  @Input()
  block: IBlock;

  /**
   * The unit in which to display value – can be either a valid denomination for
   * this chain or an alternative currency in which to estimate value.
   */
  @Input()
  displayValueCode: string;

  @Input()
  summary = true;

  listTransactionsInBlock(block: IBlock) {
    // tslint:disable-next-line:no-console
    console.log('TODO: jump to transaction listing for block:', block.hash);
  }
  listBlocksBySameMiner(block: IBlock) {
    // tslint:disable-next-line:no-console
    console.log(
      'TODO: jump to block listing of blocks by the same miner as block:',
      block.hash
    );
  }
}
