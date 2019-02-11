import { NgModule } from '@angular/core';
import { IonicModule } from 'ionic-angular';
import { SplitPipe } from '../../pipes/split/split';
import { TransactionComponent } from './transaction';

@NgModule({
  declarations: [TransactionComponent, SplitPipe],
  imports: [IonicModule],
  exports: [TransactionComponent]
})
export class TransactionComponentModule {}
