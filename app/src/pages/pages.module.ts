import { NgModule }         from '@angular/core';
import { IonicModule }      from 'ionic-angular';
import { ComponentsModule } from '../components';
import { HeadNavComponentModule } from '../components/head-nav/head-nav.module';
import { LatestTransactionsComponentModule } from '../components/latest-transactions/latest-transactions.module';
import { LatestBlocksComponentModule } from '../components/latest-blocks/latest-blocks.module';
import {
  HomePage,
  BlocksPage,
  BroadcastTxPage,
  NodeStatusPage,
  VerifyMessagePage
} from './index';

@NgModule({
  declarations: [
    HomePage,
    BlocksPage,
    BroadcastTxPage,
    NodeStatusPage,
    VerifyMessagePage
  ],
  imports: [
    IonicModule,
    ComponentsModule,
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
