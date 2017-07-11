import { Component }       from '@angular/core';
import { NavController }   from 'ionic-angular';

@Component({
  templateUrl: './broadcastTxPage.html'
})

export class BroadcastTxPage {

  public title: string;
  private nav: NavController;

  constructor(nav: NavController) {
    this.nav = nav;
    this.title = 'Broadcast Transaction';
  }
}
