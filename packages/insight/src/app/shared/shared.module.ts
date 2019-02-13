import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { BytesPipe } from 'angular-pipes';
import { BlockComponent } from './block/block.component';
import { CardItemComponent } from './card-item/card-item.component';
import { CurrencyValueComponent } from './currency-value/currency-value.component';
import { DateTimeComponent } from './date-time/date-time.component';
import { OutputComponent } from './output/output.component';
import { OutputsListComponent } from './outputs-list/outputs-list.component';
import { TransactionListComponent } from './transaction-list/transaction-list.component';
import { TransactionComponent } from './transaction/transaction.component';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule],
  declarations: [
    BlockComponent,
    OutputComponent,
    OutputsListComponent, // TODO: Abstract *ListComponent into a single ListComponent
    TransactionComponent,
    TransactionListComponent,
    DateTimeComponent,
    CurrencyValueComponent,
    CardItemComponent,
    BytesPipe
  ],
  exports: [
    BlockComponent,
    OutputComponent,
    OutputsListComponent,
    TransactionComponent,
    TransactionListComponent,
    CardItemComponent,
    DateTimeComponent,
    CurrencyValueComponent
  ]
})
export class SharedModule {}
