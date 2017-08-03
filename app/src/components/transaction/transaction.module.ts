import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionComponent } from './transaction';

@NgModule({
  declarations: [
    TransactionComponent,
  ],
  imports: [
    IonicModule,
  ],
  exports: [
    TransactionComponent
  ]
})
export class TransactionComponentModule {}
