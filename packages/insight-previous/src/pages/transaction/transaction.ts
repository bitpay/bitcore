import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { TxsProvider } from '../../providers/transactions/transactions';

@IonicPage({
  name: 'transaction',
  segment: ':chain/:network/tx/:txId'
})
@Component({
  selector: 'page-transaction',
  templateUrl: 'transaction.html'
})
export class TransactionPage {
  public loading = true;
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
    this.apiProvider.changeNetwork({ chain, network });
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
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network,
      blockHash
    });
  }
}
