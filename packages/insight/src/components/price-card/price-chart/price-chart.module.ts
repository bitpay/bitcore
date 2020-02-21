import { NgModule } from '@angular/core';
import { MomentModule } from 'angular2-moment';
import { IonicModule } from 'ionic-angular';
import { LoaderComponentModule } from '../../../components/loader/loader.module';
import { ErrorComponentModule } from '../../error/error.module';
import { PriceChartComponent } from './price-chart';

@NgModule({
  declarations: [PriceChartComponent],
  imports: [
    IonicModule,
    MomentModule,
    LoaderComponentModule,
    ErrorComponentModule
  ],
  exports: [PriceChartComponent]
})
export class PriceChartModule {}
