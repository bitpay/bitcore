import { NgModule } from '@angular/core';
import { MomentModule } from 'angular2-moment';
import { IonicModule } from 'ionic-angular';
import { AlertComponentModule } from '../../components/alert/alert.module';
import { LoaderComponentModule } from '../../components/loader/loader.module';
import { LatestBlocksComponent } from './latest-blocks';

@NgModule({
  declarations: [LatestBlocksComponent],
  imports: [
    IonicModule,
    MomentModule,
    LoaderComponentModule,
    AlertComponentModule
  ],
  exports: [LatestBlocksComponent]
})
export class LatestBlocksComponentModule {}
