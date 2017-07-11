import { Component }       from '@angular/core';
import { NavController }   from 'ionic-angular';

@Component({
  templateUrl: './verifyMessagePage.html'
})

export class VerifyMessagePage {

  public title: string;
  private nav: NavController;

  constructor(nav: NavController) {
    this.nav = nav;
    this.title = 'Verify Signed Message';
  }
}
