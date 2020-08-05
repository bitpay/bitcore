import { Component, Input, OnInit } from '@angular/core';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { BlocksProvider } from '../../providers/blocks/blocks';
import { CurrencyProvider } from '../../providers/currency/currency';
import { RedirProvider } from '../../providers/redir/redir';
import { TxsProvider } from '../../providers/transactions/transactions';

/**
 * Generated class for the TransactionDetailsEthComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'transaction-details-eth',
  templateUrl: 'transaction-details-eth.html'
})
export class TransactionDetailsEthComponent implements OnInit {
  @Input()
  public tx: any = {};
  @Input()
  public showCoins = false;
  @Input()
  public chainNetwork: ChainNetwork;

  public confirmations: number;

  constructor(
    public currencyProvider: CurrencyProvider,
    public apiProvider: ApiProvider,
    public txProvider: TxsProvider,
    public redirProvider: RedirProvider,
    public blocksProvider: BlocksProvider
  ) {}

  public ngOnInit(): void {
    this.txProvider
      .getConfirmations(this.tx.blockheight, this.chainNetwork)
      .subscribe(confirmations => {
        this.tx.confirmations = confirmations;
      });
  }

  public goToTx(txId: string, vout?: number, fromVout?: boolean): void {
    this.redirProvider.redir('transaction', {
      txId,
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network,
      vout,
      fromVout
    });
  }

  public goToAddress(addrStr: string): void {
    this.redirProvider.redir('address', {
      addrStr,
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    });
  }
}
