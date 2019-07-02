import { NgModule } from '@angular/core';
import { QRCodeModule } from 'angular2-qrcode';
import { IonicPageModule } from 'ionic-angular';
import { AlertComponentModule } from '../../components/alert/alert.module';
import { CoinListComponentModule } from '../../components/coin-list/coin-list.module';
import { FooterComponentModule } from '../../components/footer/footer.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { LoaderComponentModule } from '../../components/loader/loader.module';
import { TransactionListComponentModule } from '../../components/transaction-list/transaction-list.module';
import { CopyToClipboardModule } from '../../directives/copy-to-clipboard/copy-to-clipboard.module';
import { AddressPage } from './address';

@NgModule({
  declarations: [AddressPage],
  imports: [
    IonicPageModule.forChild(AddressPage),
    CoinListComponentModule,
    TransactionListComponentModule,
    FooterComponentModule,
    HeadNavComponentModule,
    QRCodeModule,
    LoaderComponentModule,
    AlertComponentModule,
    CopyToClipboardModule
  ],
  exports: [AddressPage]
})
export class AddressPageModule {}
