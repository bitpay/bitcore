import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';

/**
 * Generated class for the BroadcastTxPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage()
@Component({
  selector: 'page-broadcast-tx',
  templateUrl: 'broadcast-tx.html'
})
export class BroadcastTxPage {

  public title: string;
  private nav: NavController;
  public transaction: string;
  public txForm: FormGroup;
  private status: string;
  // private txid: any;

  constructor(public navCtrl: NavController, public navParams: NavParams, public formBuilder: FormBuilder, private http: Http, private api: ApiProvider) {
    this.nav = navCtrl;
    this.title = 'Broadcast Transaction';
    this.txForm = formBuilder.group({
      rawData: ['', Validators.pattern(/^[0-9A-Fa-f]+$/)]
    });
  }

  public ionViewDidLoad(): void {
    console.log('ionViewDidLoad BroadcastTxPage');
  }

  public send(): void {
    let postData: any = {
      rawtx: this.transaction
    };
    this.status = 'loading';

    console.log('the postData is', postData);

    this.http.post(this.api.apiPrefix + 'tx/send', postData)
    .subscribe(
      response => console.log('response', response),
      err => console.log('err', err)
    );
    /*
      .error(function(data, status, headers, config) {
        $scope.status = 'error';
        if(data) {
          $scope.error = data;
        } else {
          $scope.error = "No error message given (connection error?)"
        }
      });
     */
  }
}
