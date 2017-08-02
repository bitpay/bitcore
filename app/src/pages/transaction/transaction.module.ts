import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { TransactionPage } from './transaction';
import { TransactionsComponentModule } from '../../components/transactions/transactions.module';

@NgModule({
  declarations: [
    TransactionPage
  ],
  imports: [
    IonicPageModule.forChild(TransactionPage),
    TransactionsComponentModule
  ],
  exports: [
    TransactionPage
  ]
})
export class TransactionPageModule {}
