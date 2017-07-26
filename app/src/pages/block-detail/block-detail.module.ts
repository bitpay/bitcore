import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { BlockDetailPage } from './block-detail';

@NgModule({
  declarations: [
    BlockDetailPage
  ],
  imports: [
    IonicPageModule.forChild(BlockDetailPage)
  ],
  exports: [
    BlockDetailPage
  ]
})
export class BlockDetailPageModule {}
