import { NgModule } from '@angular/core';
import { MomentModule } from 'angular2-moment';
import { IonicModule } from 'ionic-angular';
import { LoaderComponentModule } from '../../components/loader/loader.module';
import { ErrorComponentModule } from '../error/error.module';
import { DailyTransactionChartComponent } from './daily-transaction-chart';

@NgModule({
  declarations: [DailyTransactionChartComponent],
  imports: [
    IonicModule,
    MomentModule,
    LoaderComponentModule,
    ErrorComponentModule
  ],
  exports: [DailyTransactionChartComponent]
})
export class DailyTransactionChartComponentModule {}
