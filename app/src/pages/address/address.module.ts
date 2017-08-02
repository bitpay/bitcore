import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AddressPage } from './address';
import { TransactionsComponentModule } from '../../components/transactions/transactions.module';

@NgModule({
  declarations: [
    AddressPage
  ],
  imports: [
    IonicPageModule.forChild(AddressPage),
    TransactionsComponentModule
  ],
  exports: [
    AddressPage
  ]
})
export class AddressPageModule {}
