import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DailyTransactionChartComponentModule } from '../../components/daily-transaction-chart/daily-transaction-chart.module';
import { ErrorComponentModule } from '../../components/error/error.module';
import { FooterComponentModule } from '../../components/footer/footer.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { LatestBlocksComponentModule } from '../../components/latest-blocks/latest-blocks.module';
import { LoaderComponentModule } from '../../components/loader/loader.module';
import { PriceChartModule } from '../../components/price-card/price-chart/price-chart.module';
import { HomePage } from './home';

@NgModule({
  declarations: [HomePage],
  imports: [
    IonicPageModule.forChild(HomePage),
    LatestBlocksComponentModule,
    DailyTransactionChartComponentModule,
    PriceChartModule,
    FooterComponentModule,
    HeadNavComponentModule,
    LoaderComponentModule,
    ErrorComponentModule
  ],
  exports: [HomePage]
})
export class HomePageModule {}
