'use strict';

import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Component }                          from '@angular/core';
import { ClickersService }                    from '../../services';

@Component({
  selector: 'clicker-form',
  templateUrl: './clickerForm.html',
})

export class ClickerForm {

  private clickerService: ClickersService;
  public form: FormGroup;

  constructor(clickerService: ClickersService, fb: FormBuilder) {
    this.clickerService = clickerService;

    this.form = fb.group({
      clickerNameInput: ['', Validators.required],
    });
  }

  public newClicker(formValue: Object): boolean {

    // need to mark the clickerName control as touched so validation
    // will apply after the user has tried to add a clicker
    this.form.controls['clickerNameInput'].markAsTouched();

    if (!this.form.controls['clickerNameInput'].valid) {
      return false;
    }

    this.clickerService.newClicker(formValue['clickerNameInput']);

    this.form.reset();

    return true;
  }
}
