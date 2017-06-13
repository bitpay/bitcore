'use strict';

import { Component } from '@angular/core';
import { Alert, AlertController } from 'ionic-angular';

@Component({
  templateUrl: './page2.html',
})

export class Page2 {

  public okEd: boolean;
  public alert1: Alert;
  public alertController: AlertController;

  constructor(alertController: AlertController) {
    this.alertController = alertController;

  };

  public title: string = 'Page 2';

  public onGainChange(): void {
    return;
  }

  public showSimpleAlert(): any {

    this.alert1 = this.alertController.create({
      title: 'This is an example for an alert',
      buttons: ['Ok', 'Dismiss'],
    });

    this.alert1.present();
  }

  public showMoreAdvancedAlert(): any {

    this.alert1 = this.alertController.create({
      title: 'This is an example for an alert',
      buttons: [{
        text: 'More Advanced Ok',
        handler: this.OK,
      }
        , 'Dismiss'],
    });

    this.alert1.present();
  }

  public OK = () => {

    this.okEd = true;
  }
}
