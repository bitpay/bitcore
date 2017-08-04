import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { TransactionPage } from './transaction';
import { TransactionComponentModule } from '../../components/transaction/transaction.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';

@NgModule({
  declarations: [
    TransactionPage
  ],
  imports: [
    IonicPageModule.forChild(TransactionPage),
    TransactionComponentModule,
    HeadNavComponentModule
  ],
  exports: [
    TransactionPage
  ]
})
export class TransactionPageModule {}
