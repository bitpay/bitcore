import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { BlockComponent } from './block/block.component';
import { CurrencyValueComponent } from './currency-value/currency-value.component';
import { DateTimeComponent } from './date-time/date-time.component';

@NgModule({
  imports: [CommonModule],
  declarations: [BlockComponent, DateTimeComponent, CurrencyValueComponent],
  exports: [BlockComponent, DateTimeComponent, CurrencyValueComponent]
})
export class SharedModule {}
