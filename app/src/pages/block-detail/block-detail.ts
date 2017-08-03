import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';

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

  public loading: boolean = true;
  private blockHash: string;
  public block: any = {
    tx: []
  };

  constructor(public navCtrl: NavController, private http: Http, public navParams: NavParams, private api: ApiProvider) {
    this.blockHash = navParams.get('blockHash');

    this.http.get(this.api.apiPrefix + 'block/' + this.blockHash).subscribe(
      (data) => {
        this.block = JSON.parse(data['_body']);
        this.loading = false;
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }

  public ionViewWillLeave(): void {
    this.loading = true;
  }

  public goToPreviousBlock(): void {
    this.navCtrl.push('block-detail', {
      'blockHash': this.block.previousblockhash
    });
  }

  public goToNextBlock(): void {
    this.navCtrl.push('block-detail', {
      'blockHash': this.block.nextblockhash
    });
  }

}
