import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionListComponent } from './transaction-list';
import { TransactionComponentModule } from '../transaction/transaction.module';

@NgModule({
  declarations: [
    TransactionListComponent
  ],
  imports: [
    IonicModule,
    TransactionComponentModule
  ],
  exports: [
    TransactionListComponent
  ]
})
export class TransactionListComponentModule {}
