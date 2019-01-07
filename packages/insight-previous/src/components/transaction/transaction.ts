import { Component, OnInit } from '@angular/core';
import { Input } from '@angular/core';
import { NavController } from 'ionic-angular';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { ApiCoin, TxsProvider } from '../../providers/transactions/transactions';

/**
 * Generated class for the TransactionComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'transaction',
  templateUrl: 'transaction.html'
})
export class TransactionComponent implements OnInit {
  private COIN = 100000000;

  public expanded = false;
  @Input() public tx: any = {};
  @Input() public showCoins = false;

  constructor(
    private navCtrl: NavController,
    public currency: CurrencyProvider,
    public apiProvider: ApiProvider,
    public txProvider: TxsProvider
  ) { }

  public ngOnInit(): void {
    if (this.showCoins) {
      this.getCoins();
    }
  }

  public getCoins(): void {
    this.txProvider.getCoins(this.tx.txid).subscribe(data => {
      this.tx.vin = data.inputs;
      this.tx.vout = data.outputs;
      this.tx.fee = this.txProvider.getFee(this.tx);
      this.tx.valueOut = data.outputs.reduce((a, b) => a + b.value, 0);
    });
  }

  public getAddress(vout: ApiCoin): string {
    if (vout.address === 'false') {
      return 'Unparsed address';
    }

    return vout.address;
  }

  public goToTx(txId: string): void {
    this.navCtrl.push('transaction', {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network,
      txId
    });
  }

  public goToAddress(addrStr: string): void {
    this.navCtrl.push('address', {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network,
      addrStr
    });
  }

  public toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  public aggregateItems(items: any[]): any[] {
    if (!items) { return []; }

    const l: number = items.length;

    const ret: any[] = [];
    const tmp: any = {};
    let u = 0;

    for (let i = 0; i < l; i++) {
      let notAddr = false;
      // non standard input
      if (items[i].scriptSig && !items[i].address) {
        items[i].address = 'Unparsed address [' + u++ + ']';
        items[i].notAddr = true;
        notAddr = true;
      }

      // non standard output
      if (items[i].scriptPubKey && !items[i].scriptPubKey.addresses) {
        items[i].scriptPubKey.addresses = ['Unparsed address [' + u++ + ']'];
        items[i].notAddr = true;
        notAddr = true;
      }

      // multiple addr at output
      if (items[i].scriptPubKey && items[i].scriptPubKey.addresses.length > 1) {
        items[i].address = items[i].scriptPubKey.addresses.join(',');
        ret.push(items[i]);
        continue;
      }

      const address: string = items[i].address || (items[i].scriptPubKey && items[i].scriptPubKey.addresses[0]);

      if (!tmp[address]) {
        tmp[address] = {};
        tmp[address].valueSat = 0;
        tmp[address].count = 0;
        tmp[address].address = address;
        tmp[address].items = [];
      }
      tmp[address].isSpent = items[i].spentTxId;

      tmp[address].doubleSpentTxID = tmp[address].doubleSpentTxID || items[i].doubleSpentTxID;
      tmp[address].doubleSpentIndex = tmp[address].doubleSpentIndex || items[i].doubleSpentIndex;
      tmp[address].dbError = tmp[address].dbError || items[i].dbError;
      tmp[address].valueSat += Math.round(items[i].value * this.COIN);
      tmp[address].items.push(items[i]);
      tmp[address].notAddr = notAddr;

      if (items[i].unconfirmedInput) { tmp[address].unconfirmedInput = true; }

      tmp[address].count++;
    }

    for (const v in tmp) {
      const obj: any = tmp[v];
      obj.value = obj.value || parseInt(obj.valueSat) / this.COIN;
      ret.push(obj);
    }

    return ret;
  }
}
