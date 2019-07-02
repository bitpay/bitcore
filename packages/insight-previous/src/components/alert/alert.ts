import { Component, Input } from '@angular/core';

@Component({
  selector: 'alert-component',
  templateUrl: 'alert.html'
})
export class AlertComponent {
  @Input()
  public message: string;
  @Input()
  public messageType: string;
  @Input()
  public link: string;
}
