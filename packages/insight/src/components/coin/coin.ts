import { Component, Input } from '@angular/core';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { RedirProvider } from '../../providers/redir/redir';
import { TxsProvider } from '../../providers/transactions/transactions';

@Component({
  selector: 'coin',
  templateUrl: 'coin.html'
})
export class CoinComponent {
  @Input()
  public coin;
  @Input()
  public blockTipHeight;
  @Input()
  public chainNetwork: ChainNetwork;

  public mintTxid?: any;
  public spentTxid?: any;
  public mintHeight?: number;
  public spentHeight?: number;
  public time?: any;
  public timeHidden = true;

  public confirmations?: number;

  constructor(
    public apiProvider: ApiProvider,
    public currencyProvider: CurrencyProvider,
    public redirProvider: RedirProvider,
    public txProvider: TxsProvider
  ) {}

  // tslint:disable-next-line:use-life-cycle-interface
  ngOnInit() {
    this.time = new Date(this.coin.blockTime).getTime() / 1000;
    this.confirmations = this.blockTipHeight - this.coin.height + 1;
  }

  public revealTimeReceived(txid: string) {
    this.txProvider.getTx(txid, this.chainNetwork).subscribe(tx => {
      this.coin.time = new Date(tx.blockTime).getTime() / 1000;
      this.timeHidden = false;
    });
  }

  public goToTx(txId: string): void {
    this.redirProvider.redir('transaction', {
      txId,
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    });
  }
}
