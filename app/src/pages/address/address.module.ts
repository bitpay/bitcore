import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AddressPage } from './address';
import { TransactionListComponentModule } from '../../components/transaction-list/transaction-list.module';

@NgModule({
  declarations: [
    AddressPage
  ],
  imports: [
    IonicPageModule.forChild(AddressPage),
    TransactionListComponentModule
  ],
  exports: [
    AddressPage
  ]
})
export class AddressPageModule {}
