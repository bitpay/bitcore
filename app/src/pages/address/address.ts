import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Http } from '@angular/http';

/**
 * Generated class for the AddressPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'address',
  segment: 'address/:addrStr'
})
@Component({
  selector: 'page-address',
  templateUrl: 'address.html'
})
export class AddressPage {

  public loading: boolean = true;
  private addrStr: string;
  public address: any = {};

  constructor(public navCtrl: NavController, public navParams: NavParams, private http: Http) {
    this.addrStr = navParams.get('addrStr');
  }

  public ionViewDidLoad(): void {
    let apiPrefix: string = 'http://localhost:3001/insight-api/';

    this.http.get(apiPrefix + 'addr/' + this.addrStr + '/?noTxList=1').subscribe(
      (data) => {
        this.address = JSON.parse(data['_body']);
        this.loading = false;
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }

}
