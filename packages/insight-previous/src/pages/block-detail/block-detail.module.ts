import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { TransactionListComponentModule } from '../../components/transaction-list/transaction-list.module';
import { BlockDetailPage } from './block-detail';

@NgModule({
  declarations: [BlockDetailPage],
  imports: [
    IonicPageModule.forChild(BlockDetailPage),
    TransactionListComponentModule,
    HeadNavComponentModule
  ],
  exports: [BlockDetailPage]
})
export class BlockDetailPageModule {}
