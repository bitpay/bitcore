import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionComponentModule } from '../transaction/transaction.module';
import { TransactionListComponent } from './transaction-list';

@NgModule({
  declarations: [TransactionListComponent],
  imports: [IonicModule, TransactionComponentModule],
  exports: [TransactionListComponent]
})
export class TransactionListComponentModule {}
