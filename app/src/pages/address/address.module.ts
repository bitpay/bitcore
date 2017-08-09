import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AddressPage } from './address';
import { TransactionListComponentModule } from '../../components/transaction-list/transaction-list.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { QRCodeModule } from 'angular2-qrcode';

@NgModule({
  declarations: [
    AddressPage
  ],
  imports: [
    IonicPageModule.forChild(AddressPage),
    TransactionListComponentModule,
    HeadNavComponentModule,
    QRCodeModule
  ],
  exports: [
    AddressPage
  ]
})
export class AddressPageModule {}
