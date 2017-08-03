import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { BlockDetailPage } from './block-detail';
import { TransactionListComponentModule } from '../../components/transaction-list/transaction-list.module';

@NgModule({
  declarations: [
    BlockDetailPage
  ],
  imports: [
    IonicPageModule.forChild(BlockDetailPage),
    TransactionListComponentModule
  ],
  exports: [
    BlockDetailPage
  ]
})
export class BlockDetailPageModule {}
