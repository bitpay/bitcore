import { NgModule } from '@angular/core';
import { MomentModule } from 'angular2-moment';
import { IonicModule } from 'ionic-angular';
import { LatestBlocksComponent } from './latest-blocks';

@NgModule({
  declarations: [LatestBlocksComponent],
  imports: [IonicModule, MomentModule],
  exports: [LatestBlocksComponent]
})
export class LatestBlocksComponentModule {}
