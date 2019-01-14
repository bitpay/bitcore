import { NgModule } from '@angular/core';
import { QRCodeModule } from 'angular2-qrcode';
import { IonicPageModule } from 'ionic-angular';
import { CoinListComponentModule } from '../../components/coin-list/coin-list.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { TransactionListComponentModule } from '../../components/transaction-list/transaction-list.module';
import { AddressPage } from './address';

@NgModule({
  declarations: [AddressPage],
  imports: [
    IonicPageModule.forChild(AddressPage),
    CoinListComponentModule,
    TransactionListComponentModule,
    HeadNavComponentModule,
    QRCodeModule
  ],
  exports: [AddressPage]
})
export class AddressPageModule {}
