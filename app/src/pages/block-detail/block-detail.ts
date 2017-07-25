import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';

/**
 * Generated class for the BlockDetailPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'block-detail'
})
@Component({
  selector: 'page-block-detail',
  templateUrl: 'block-detail.html',
})
export class BlockDetailPage {

  blockHash: string;

  constructor(public navCtrl: NavController, public navParams: NavParams) {
    this.blockHash = navParams.get('blockHash');
    console.log('blockHash is', this.blockHash);
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad BlockDetailPage');
  }

}
