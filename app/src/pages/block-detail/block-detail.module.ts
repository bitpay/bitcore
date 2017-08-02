import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { BlockDetailPage } from './block-detail';
import { TransactionsComponentModule } from '../../components/transactions/transactions.module';

@NgModule({
  declarations: [
    BlockDetailPage
  ],
  imports: [
    IonicPageModule.forChild(BlockDetailPage),
    TransactionsComponentModule
  ],
  exports: [
    BlockDetailPage
  ]
})
export class BlockDetailPageModule {}
