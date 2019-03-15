import { Component, Injectable } from '@angular/core';
import { IonicPage, NavParams } from 'ionic-angular';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
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
  private txId: string;
  private chainNetwork: ChainNetwork;
  public tx: any = {};
  public vout: number;
  public fromVout: boolean;
  public confirmations: number;
  public errorMessage: string;

  constructor(
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private txProvider: TxsProvider,
    public currencyProvider: CurrencyProvider,
    private logger: Logger,
    private priceProvider: PriceProvider,
    public redirProvider: RedirProvider,
    private blocksProvider: BlocksProvider
  ) {
    this.txId = navParams.get('txId');
    this.vout = navParams.get('vout');
    this.fromVout = navParams.get('fromVout') || undefined;

    const chain: string =
      navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      navParams.get('network') || this.apiProvider.getConfig().network;

    this.chainNetwork = {
      chain,
      network
    };
    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency();
    this.priceProvider.setCurrency();
  }

  public ionViewDidLoad(): void {
    this.txProvider.getTx(this.txId).subscribe(
      data => {
        this.tx = data.tx;
        this.loading = false;
        this.txProvider
          .getConfirmations(this.tx.blockheight)
          .subscribe(confirmations => (this.confirmations = confirmations));
        // Be aware that the tx component is loading data into the tx object
      },
      err => {
        this.logger.error(err);
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
