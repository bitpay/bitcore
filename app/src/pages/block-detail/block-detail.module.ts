import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { BlockDetailPage } from './block-detail';
import { TransactionsComponent } from '../../components/transactions/transactions';

@NgModule({
  declarations: [
    BlockDetailPage,
    TransactionsComponent
  ],
  imports: [
    IonicPageModule.forChild(BlockDetailPage)
  ],
  exports: [
    BlockDetailPage
  ]
})
export class BlockDetailPageModule {}
