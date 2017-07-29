import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionsComponent } from './transactions';

@NgModule({
  declarations: [
    TransactionsComponent
  ],
  imports: [
    IonicModule
  ],
  exports: [
    TransactionsComponent
  ]
})
export class TransactionsComponentModule {}
