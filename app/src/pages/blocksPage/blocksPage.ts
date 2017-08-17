import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Observable } from 'rxjs';
import { Block } from '../../models';
import { BlocksService } from '../../services';

@Component({
  templateUrl: './blocksPage.html'
})

export class BlocksPage {

  public title: string;
  public blocks: Observable<Block[]>;

  constructor(private navCtrl: NavController, private blocksService: BlocksService) {
    // TODO Put loading spinner on page

    this.title = 'Blocks';
    this.blocks = blocksService.latestBlocks;
    this.blocks.subscribe((blocks) => {
      console.log('blocks', blocks);
    });
    blocksService.getLatestBlocks();
  }

  public goToBlock(blockHash: string): void {
    this.navCtrl.push('block-detail', {
      'blockHash': blockHash
    });
  }

}
