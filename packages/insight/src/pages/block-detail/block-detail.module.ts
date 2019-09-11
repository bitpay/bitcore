import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { BlockSummaryEthComponentModule } from '../../components/block-summary-eth/block-summary-eth.module';
import { BlockSummaryComponentModule } from '../../components/block-summary/block-summary.module';
import { ErrorComponentModule } from '../../components/error/error.module';
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
    BlockSummaryComponentModule,
    BlockSummaryEthComponentModule,
    TransactionListComponentModule,
    FooterComponentModule,
    HeadNavComponentModule,
    LoaderComponentModule,
    ErrorComponentModule,
    CopyToClipboardModule
  ],
  exports: [BlockDetailPage]
})
export class BlockDetailPageModule {}
