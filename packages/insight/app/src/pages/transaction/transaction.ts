import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { TxsProvider } from '../../providers/transactions/transactions';
import { CurrencyProvider } from '../../providers/currency/currency';
import { ApiProvider } from '../../providers/api/api';

/**
 * Generated class for the TransactionPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@IonicPage({
  name: 'transaction',
  segment: ':chain/:network/tx/:txId'
})
@Component({
  selector: 'page-transaction',
  templateUrl: 'transaction.html'
})
export class TransactionPage {
  public loading: boolean = true;
  private txId: string;
  public tx: any = {};

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private txProvider: TxsProvider,
    public currency: CurrencyProvider
  ) {
    this.txId = navParams.get('txId');
    const chain: string = navParams.get('chain');
    const network: string = navParams.get('network');
    this.apiProvider.changeChain(chain, network);
  }

  public ionViewDidLoad(): void {
    this.txProvider.getTx(this.txId).subscribe(
      data => {
        this.tx = data.tx;
        this.loading = false;
        // Be aware that the tx component is loading data into the tx object
      },
      err => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }

  public goToBlock(blockHash: string): void {
    this.navCtrl.push('block-detail', {
      chain: this.apiProvider.selectedChain,
      network: this.apiProvider.selectedNetwork,
      blockHash: blockHash
    });
  }
}
