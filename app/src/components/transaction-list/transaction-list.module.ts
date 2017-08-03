import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionListComponent } from './transaction-list';

@NgModule({
  declarations: [
    TransactionListComponent
  ],
  imports: [
    IonicModule
  ],
  exports: [
    TransactionListComponent
  ]
})
export class TransactionListComponentModule {}
