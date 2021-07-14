import { NgModule } from '@angular/core';
import { MomentModule } from 'angular2-moment';
import { IonicModule } from 'ionic-angular';
import { LoaderComponentModule } from '../../components/loader/loader.module';
import { ErrorComponentModule } from '../error/error.module';
import { LatestBlocksComponent } from './latest-blocks';

@NgModule({
  declarations: [LatestBlocksComponent],
  imports: [
    IonicModule,
    MomentModule,
    LoaderComponentModule,
    ErrorComponentModule
  ],
  exports: [LatestBlocksComponent]
})
export class LatestBlocksComponentModule {}
