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

  public loading: boolean = true;
  private address: string;

  constructor(public navCtrl: NavController, public navParams: NavParams) {
    this.address = navParams.get('address');
  }

  public ionViewDidLoad(): void {
    console.log('ionViewDidLoad AddressPage');
  }

}
