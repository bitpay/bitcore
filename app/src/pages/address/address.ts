import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';

/**
 * Generated class for the AddressPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'address',
  segment: 'address/:address'
})
@Component({
  selector: 'page-address',
  templateUrl: 'address.html'
})
export class AddressPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  public ionViewDidLoad(): void {
    console.log('ionViewDidLoad AddressPage');
  }

}
