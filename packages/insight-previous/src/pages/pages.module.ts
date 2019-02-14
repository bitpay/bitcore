import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { ComponentsModule } from '../components';
import { FooterComponentModule } from '../components/footer/footer.module';
import { HeadNavComponentModule } from '../components/head-nav/head-nav.module';
import { LatestBlocksComponentModule } from '../components/latest-blocks/latest-blocks.module';
import { LatestTransactionsComponentModule } from '../components/latest-transactions/latest-transactions.module';
import { BlocksPageModule } from '../pages/blocks/blocks.module';
import { BroadcastTxPageModule } from './broadcast-tx/broadcast-tx.module';
import { HomePageModule } from './home/home.module';

@NgModule({
  declarations: [],
  imports: [
    IonicModule,
    ComponentsModule,
    BlocksPageModule,
    BroadcastTxPageModule,
    HomePageModule,
    FooterComponentModule,
    HeadNavComponentModule,
    LatestTransactionsComponentModule,
    LatestBlocksComponentModule
  ],
  exports: [
    // CustomComponent,
  ],
  entryComponents: [],
  providers: []
})
export class PagesModule {}
