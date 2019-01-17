import { Component, Injectable } from '@angular/core';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { RedirProvider } from '../../providers/redir/redir';
import { TxsProvider } from '../../providers/transactions/transactions';

@Injectable()
@IonicPage({
  name: 'transaction',
  segment: ':chain/:network/tx/:txId',
  defaultHistory: ['home']
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
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private txProvider: TxsProvider,
    public currency: CurrencyProvider,
    private logger: Logger,
    public redirProvider: RedirProvider
  ) {
    this.txId = navParams.get('txId');
    const chain: string = this.apiProvider.getConfig().chain;
    const network: string = this.apiProvider.getConfig().network;
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
        this.logger.error(err);
        this.loading = false;
      }
    );
  }

  public goToBlock(blockHash: string): void {
    this.redirProvider.redir('block-detail', {
      blockHash,
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    });
  }
}
