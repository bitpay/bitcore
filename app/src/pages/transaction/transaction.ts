import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { TxsProvider } from '../../providers/transactions/transactions';

/**
 * Generated class for the TransactionPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'transaction',
  segment: 'tx/:txId'
})
@Component({
  selector: 'page-transaction',
  templateUrl: 'transaction.html'
})
export class TransactionPage {

  public loading: boolean = true;
  private txId: string;
  public tx: any = {};

  constructor(public navCtrl: NavController, public navParams: NavParams, private txProvider: TxsProvider) {
    this.txId = navParams.get('txId');
  }

  public ionViewDidLoad(): void {
    this.txProvider.getTx(this.txId).subscribe(
      (data) => {
        this.tx = data.tx;
        this.loading = false;
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }

  public goToBlock(blockHash: string): void {
    this.navCtrl.push('block-detail', {
      'blockHash': blockHash
    });
  }
}
