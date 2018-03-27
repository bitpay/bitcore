import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { BroadcastTxPage } from './broadcast-tx';

@NgModule({
  declarations: [
    BroadcastTxPage
  ],
  imports: [
    IonicPageModule.forChild(BroadcastTxPage)
  ],
  exports: [
    BroadcastTxPage
  ]
})
export class BroadcastTxPageModule {}
