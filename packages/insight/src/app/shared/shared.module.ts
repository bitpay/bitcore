import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BytesPipe } from 'angular-pipes';
import { BlockComponent } from './block/block.component';
import { CardItemComponent } from './card-item/card-item.component';
import { CurrencyValueComponent } from './currency-value/currency-value.component';
import { DateTimeComponent } from './date-time/date-time.component';

@NgModule({
  imports: [CommonModule, RouterModule],
  declarations: [
    BlockComponent,
    DateTimeComponent,
    CurrencyValueComponent,
    CardItemComponent,
    BytesPipe
  ],
  exports: [
    BlockComponent,
    CardItemComponent,
    DateTimeComponent,
    CurrencyValueComponent
  ]
})
export class SharedModule {}
