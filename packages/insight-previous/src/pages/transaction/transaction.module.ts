import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { TransactionComponentModule } from '../../components/transaction/transaction.module';
import { TransactionPage } from './transaction';

@NgModule({
  declarations: [TransactionPage],
  imports: [
    IonicPageModule.forChild(TransactionPage),
    TransactionComponentModule,
    HeadNavComponentModule
  ],
  exports: [TransactionPage]
})
export class TransactionPageModule {}
