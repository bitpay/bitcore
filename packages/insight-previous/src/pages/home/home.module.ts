import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { LatestBlocksComponentModule } from '../../components/latest-blocks/latest-blocks.module';
import { LatestTransactionsComponentModule } from '../../components/latest-transactions/latest-transactions.module';
import { LoaderComponentModule } from '../../components/loader/loader.module';
import { HomePage } from './home';

@NgModule({
  declarations: [HomePage],
  imports: [
    IonicPageModule.forChild(HomePage),
    LatestBlocksComponentModule,
    HeadNavComponentModule,
    LatestTransactionsComponentModule,
    LoaderComponentModule
  ],
  exports: [HomePage]
})
export class HomePageModule {}
