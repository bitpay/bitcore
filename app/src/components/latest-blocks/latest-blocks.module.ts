import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { LatestBlocksComponent } from './latest-blocks';

@NgModule({
  declarations: [
    LatestBlocksComponent
  ],
  imports: [
    IonicModule
  ],
  exports: [
    LatestBlocksComponent
  ]
})
export class LatestBlocksComponentModule {}
