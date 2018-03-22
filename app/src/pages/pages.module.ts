import { NgModule }         from '@angular/core';
import { IonicModule }      from 'ionic-angular';
import { ComponentsModule } from '../components';
import { BlocksPageModule } from '../pages/blocks/blocks.module';
import { BroadcastTxPageModule } from './broadcast-tx/broadcast-tx.module';
import { HeadNavComponentModule } from '../components/head-nav/head-nav.module';
import { LatestTransactionsComponentModule } from '../components/latest-transactions/latest-transactions.module';
import { LatestBlocksComponentModule } from '../components/latest-blocks/latest-blocks.module';
import {
  HomePage,
  NodeStatusPage,
  VerifyMessagePage
} from './index';

@NgModule({
  declarations: [
    HomePage,
    NodeStatusPage,
    VerifyMessagePage
  ],
  imports: [
    IonicModule,
    ComponentsModule,
    BlocksPageModule,
    BroadcastTxPageModule,
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
