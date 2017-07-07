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

  constructor(private nav: NavController, private blocksService: BlocksService) {
    this.nav = nav;
    this.title = 'Blocks';
    this.blocks = blocksService.latestBlocks;
    // this.blocks.subscribe((blocks) => {
    //   console.log(blocks);
    // });
    blocksService.getLatestBlocks();
  }
}
