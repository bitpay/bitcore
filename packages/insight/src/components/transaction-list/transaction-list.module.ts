import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { LoaderComponentModule } from '../loader/loader.module';
import { TransactionComponentModule } from '../transaction/transaction.module';
import { TransactionListComponent } from './transaction-list';

@NgModule({
  declarations: [TransactionListComponent],
  imports: [IonicModule, TransactionComponentModule, LoaderComponentModule],
  exports: [TransactionListComponent]
})
export class TransactionListComponentModule {}
