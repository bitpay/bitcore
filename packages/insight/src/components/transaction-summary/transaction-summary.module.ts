import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionSummaryComponent } from './transaction-summary';

@NgModule({
  declarations: [TransactionSummaryComponent],
  imports: [IonicModule],
  exports: [TransactionSummaryComponent]
})
export class TransactionSummaryComponentModule {}
