import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionDetailsComponent } from './transaction-details';

@NgModule({
  declarations: [TransactionDetailsComponent],
  imports: [IonicModule],
  exports: [TransactionDetailsComponent]
})
export class TransactionDetailsComponentModule {}
