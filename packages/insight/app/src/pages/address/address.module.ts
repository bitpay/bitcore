import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AddressPage } from './address';
import { TransactionListComponentModule } from '../../components/transaction-list/transaction-list.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { QRCodeModule } from 'angular2-qrcode';
import { CoinComponentModule } from '../../components/coin/coin.module';

@NgModule({
  declarations: [AddressPage],
  imports: [
    IonicPageModule.forChild(AddressPage),
    CoinComponentModule,
    TransactionListComponentModule,
    HeadNavComponentModule,
    QRCodeModule
  ],
  exports: [AddressPage]
})
export class AddressPageModule {}
