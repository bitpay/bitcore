import { Component, Injectable } from '@angular/core';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { PriceProvider } from '../../providers/price/price';
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
  public tx: any = {};
  public vout: number;
  public fromVout: boolean;
  public confirmations: number;
  public errorMessage: string;
  public chainNetwork: ChainNetwork;
  public prevPage: string;
  private txId: string;

  constructor(
    public navParams: NavParams,
    public currencyProvider: CurrencyProvider,
    public redirProvider: RedirProvider,
    private apiProvider: ApiProvider,
    private txProvider: TxsProvider,
    private priceProvider: PriceProvider
  ) {
    this.txId = navParams.get('txId');
    this.vout = navParams.get('vout');
    this.fromVout = navParams.get('fromVout') || undefined;

    const chain: string = navParams.get('chain');
    const network: string = navParams.get('network');

    this.chainNetwork = {
      chain,
      network
    };
    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency(this.chainNetwork);
    this.priceProvider.setCurrency();
  }

  public ionViewDidEnter(): void {
    this.txProvider.getTx(this.txId, this.chainNetwork).subscribe(
      response => {
        let tx;
        if (
          this.chainNetwork.chain === 'BTC' ||
          this.chainNetwork.chain === 'BCH'
        ) {
          tx = this.txProvider.toUtxoCoinsAppTx(response);
        }
        if (this.chainNetwork.chain === 'ETH') {
          tx = this.txProvider.toEthAppTx(response);
        }
        this.tx = tx;
        this.loading = false;
        this.txProvider
          .getConfirmations(this.tx.blockheight, this.chainNetwork)
          .subscribe(confirmations => {
            if (confirmations === -3) {
              this.errorMessage =
                'This transaction is invalid and will never confirm, because some of its inputs are already spent.';
            }
            this.confirmations = confirmations;
          });
        // Be aware that the tx component is loading data into the tx object
      },
      err => {
        this.errorMessage = err;
        this.loading = false;
      }
    );
  }

  public goToBlock(blockHash: string): void {
    this.redirProvider.redir('block-detail', {
      blockHash,
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    });
  }
}
