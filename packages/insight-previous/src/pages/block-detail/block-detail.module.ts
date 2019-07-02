import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AlertComponentModule } from '../../components/alert/alert.module';
import { FooterComponentModule } from '../../components/footer/footer.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { LoaderComponentModule } from '../../components/loader/loader.module';
import { TransactionListComponentModule } from '../../components/transaction-list/transaction-list.module';
import { CopyToClipboardModule } from '../../directives/copy-to-clipboard/copy-to-clipboard.module';
import { BlockDetailPage } from './block-detail';

@NgModule({
  declarations: [BlockDetailPage],
  imports: [
    IonicPageModule.forChild(BlockDetailPage),
    TransactionListComponentModule,
    FooterComponentModule,
    HeadNavComponentModule,
    LoaderComponentModule,
    AlertComponentModule,
    CopyToClipboardModule
  ],
  exports: [BlockDetailPage]
})
export class BlockDetailPageModule {}
