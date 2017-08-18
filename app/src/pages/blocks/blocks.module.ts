import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { BlocksPage } from './blocks';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { LatestBlocksComponentModule } from '../../components/latest-blocks/latest-blocks.module';

@NgModule({
  declarations: [
    BlocksPage
  ],
  imports: [
    IonicPageModule.forChild(BlocksPage),
    HeadNavComponentModule,
    LatestBlocksComponentModule
  ],
  exports: [
    BlocksPage
  ]
})
export class BlocksPageModule {}
