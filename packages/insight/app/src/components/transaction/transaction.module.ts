import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { TransactionComponent } from './transaction';
import { SplitPipe } from '../../pipes/split/split';

@NgModule({
  declarations: [
    TransactionComponent,
    SplitPipe
  ],
  imports: [
    IonicModule
  ],
  exports: [
    TransactionComponent
  ]
})
export class TransactionComponentModule {}
