import { Component }       from '@angular/core';
import { NavController }   from 'ionic-angular';

@Component({
  templateUrl: './nodeStatusPage.html'
})

export class NodeStatusPage {

  public title: string;
  private nav: NavController;

  constructor(nav: NavController) {
    this.nav = nav;
    this.title = 'Node Status';
  }
}
