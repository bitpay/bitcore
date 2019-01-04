import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { LatestBlocksComponentModule } from '../../components/latest-blocks/latest-blocks.module';
import { BlocksPage } from './blocks';

@NgModule({
  declarations: [BlocksPage],
  imports: [
    IonicPageModule.forChild(BlocksPage),
    HeadNavComponentModule,
    LatestBlocksComponentModule
  ],
  exports: [BlocksPage]
})
export class BlocksPageModule {}
