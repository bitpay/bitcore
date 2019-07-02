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
  public alertMessage: string;
  public alertType: string;
  public link: string;

  private txId: string;
  private chainNetwork: ChainNetwork;

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
      data => {
        this.tx = this.txProvider.toAppTx(data);
        this.loading = false;
        this.txProvider
          .getConfirmations(this.tx.blockheight, this.chainNetwork)
          .subscribe(confirmations => {
            if (confirmations === -1) {
              this.alertMessage =
                'This is an RBF transaction. Until it confirms, the transaction could be replaced/redirected by the sender.';
              this.alertType = 'warn';
              this.link =
                'https://support.bitpay.com/hc/en-us/articles/360028824532-Why-can-t-I-pay-a-BitPay-invoice-using-RBF-';
            } else if (confirmations === -3) {
              this.alertMessage =
                'This transaction is invalid and will never confirm, because some of its inputs are already spent.';
              this.alertType = 'error';
            }
            this.confirmations = confirmations;
          });
        // Be aware that the tx component is loading data into the tx object
      },
      err => {
        this.alertMessage = err;
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
