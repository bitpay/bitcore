import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { CurrencyValueComponent } from './currency-value/currency-value.component';
import { DateTimeComponent } from './date-time/date-time.component';

@NgModule({
  imports: [CommonModule],
  declarations: [DateTimeComponent, CurrencyValueComponent],
  exports: [DateTimeComponent, CurrencyValueComponent]
})
export class SharedModule {}
