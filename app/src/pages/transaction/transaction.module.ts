import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { TransactionPage } from './transaction';
import { TransactionComponentModule } from '../../components/transaction/transaction.module';

@NgModule({
  declarations: [
    TransactionPage
  ],
  imports: [
    IonicPageModule.forChild(TransactionPage),
    TransactionComponentModule
  ],
  exports: [
    TransactionPage
  ]
})
export class TransactionPageModule {}
