import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { HeadNavComponentModule } from '../../components/head-nav/head-nav.module';
import { BroadcastTxPage } from './broadcast-tx';

@NgModule({
  declarations: [BroadcastTxPage],
  imports: [IonicPageModule.forChild(BroadcastTxPage), HeadNavComponentModule],
  exports: [BroadcastTxPage]
})
export class BroadcastTxPageModule {}
