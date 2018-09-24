import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { LatestBlocksComponent } from './latest-blocks';
import { MomentModule } from 'angular2-moment';

@NgModule({
  declarations: [
    LatestBlocksComponent
  ],
  imports: [
    IonicModule,
    MomentModule
  ],
  exports: [
    LatestBlocksComponent
  ]
})
export class LatestBlocksComponentModule {}
