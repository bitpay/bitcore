import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Http } from '@angular/http';

/**
 * Generated class for the BlockDetailPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'block-detail',
  segment: 'block/:blockHash'
})
@Component({
  selector: 'page-block-detail',
  templateUrl: 'block-detail.html'
})
export class BlockDetailPage {

  private blockHash: string;
  public block: any = {
    tx: []
  };

  constructor(public navCtrl: NavController, private http: Http, public navParams: NavParams) {
    this.blockHash = navParams.get('blockHash');
    console.log('blockHash is', this.blockHash);

    let apiPrefix: string = 'http://localhost:3001/insight-api/';

    this.http.get(apiPrefix + 'block/' + this.blockHash).subscribe(
      (data) => {
        console.log('block is', data);
        this.block = JSON.parse(data['_body']);
        console.log('this.block is', this.block);
      },
      (err) => {
        console.log('err is', err);
      }
    );
  }

  public ionViewDidLoad(): void {
    console.log('ionViewDidLoad BlockDetailPage');
  }

}
