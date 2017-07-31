import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AddressPage } from './address';
import { TransactionsComponent } from '../../components/transactions/transactions';

@NgModule({
  declarations: [
    AddressPage,
    TransactionsComponent
  ],
  imports: [
    IonicPageModule.forChild(AddressPage)
  ],
  exports: [
    AddressPage
  ]
})
export class AddressPageModule {}
