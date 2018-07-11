import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { NavController } from 'ionic-angular';
import { CurrencyProvider } from '../../providers/currency/currency';
import { TxsProvider, ApiInput } from '../../providers/transactions/transactions';

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
export class TransactionComponent {
  private COIN: number = 100000000;

  public expanded: boolean = false;
  @Input() public tx: any = {};
  @Input() public showCoins?: boolean = false;

  constructor(
    private navCtrl: NavController,
    public currency: CurrencyProvider,
    public txProvider: TxsProvider
  ) {
  }

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

  public getAddress(vout: ApiInput): string {
    if (vout.address === 'false') {
      return 'Unparsed address';
    }

    return vout.address;
  }

  public goToTx(txId: string): void {
    this.navCtrl.push('transaction', {
      selectedCurrency: this.currency.selectedCurrency,
      txId: txId
    });
  }

  public goToAddress(addrStr: string): void {
    this.navCtrl.push('address', {
      selectedCurrency: this.currency.selectedCurrency,
      addrStr: addrStr
    });
  }

  public toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  public aggregateItems(items: Array<any>): Array<any> {
    if (!items) return [];

    let l: number = items.length;

    let ret: Array<any> = [];
    let tmp: any = {};
    let u: number = 0;

    for (let i: number = 0; i < l; i++) {
      let notAddr: boolean = false;
      // non standard input
      if (items[i].scriptSig && !items[i].addr) {
        items[i].addr = 'Unparsed address [' + u++ + ']';
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
        items[i].addr = items[i].scriptPubKey.addresses.join(',');
        ret.push(items[i]);
        continue;
      }

      let addr: string = items[i].addr || (items[i].scriptPubKey && items[i].scriptPubKey.addresses[0]);

      if (!tmp[addr]) {
        tmp[addr] = {};
        tmp[addr].valueSat = 0;
        tmp[addr].count = 0;
        tmp[addr].addr = addr;
        tmp[addr].items = [];
      }
      tmp[addr].isSpent = items[i].spentTxId;

      tmp[addr].doubleSpentTxID = tmp[addr].doubleSpentTxID || items[i].doubleSpentTxID;
      tmp[addr].doubleSpentIndex = tmp[addr].doubleSpentIndex || items[i].doubleSpentIndex;
      tmp[addr].dbError = tmp[addr].dbError || items[i].dbError;
      tmp[addr].valueSat += Math.round(items[i].value * this.COIN);
      tmp[addr].items.push(items[i]);
      tmp[addr].notAddr = notAddr;

      if (items[i].unconfirmedInput) tmp[addr].unconfirmedInput = true;

      tmp[addr].count++;
    }

    for (let v in tmp) {
      let obj: any = tmp[v];
      obj.value = obj.value || parseInt(obj.valueSat) / this.COIN;
      ret.push(obj);
    }

    return ret;
  }
}
