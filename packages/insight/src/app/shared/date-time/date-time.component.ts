import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-date-time',
  templateUrl: './date-time.component.html',
  styleUrls: ['./date-time.component.scss']
})
export class DateTimeComponent implements OnChanges {
  @Input()
  value: any;
  inThePastDay: boolean;

  ngOnChanges() {
    const twentyFourHoursBeforeNow = new Date(Date.now() - 1000 * 60 * 60 * 24);
    this.inThePastDay = twentyFourHoursBeforeNow < new Date(this.value);
  }
}
