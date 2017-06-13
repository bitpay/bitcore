'use strict';

import { Component, Input } from '@angular/core';
import { ClickersService }  from '../../services';
import { Clicker }          from '../../models';

@Component({
  selector: 'clicker-button',
  templateUrl: './clickerButton.html',
})

export class ClickerButton {
  @Input() public clicker: Clicker;

  public clickerService: ClickersService;

  constructor(clickerService: ClickersService) {
    this.clickerService = clickerService;
  }
}
