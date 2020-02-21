import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { FooterComponentModule } from '../../components/footer/footer.module';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { LatestBlocksComponentModule } from '../../components/latest-blocks/latest-blocks.module';
import { LoaderComponentModule } from '../../components/loader/loader.module';
import { BlocksPage } from './blocks';

@NgModule({
  declarations: [BlocksPage],
  imports: [
    IonicPageModule.forChild(BlocksPage),
    FooterComponentModule,
    HeadNavComponentModule,
    LatestBlocksComponentModule,
    LoaderComponentModule
  ],
  exports: [BlocksPage]
})
export class BlocksPageModule {}
