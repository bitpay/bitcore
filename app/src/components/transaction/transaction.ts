import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { NavController } from 'ionic-angular';

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

  @Input() public tx: any = {};

  constructor(private navCtrl: NavController) {
  }

  public getAddress(vout: any): string {
    if (vout.scriptPubKey && vout.scriptPubKey.addresses) {
      return vout.scriptPubKey.addresses[0];
    } else {
      return 'Unparsed address';
    }
  }

  public goToTx(txId: string): void {
    this.navCtrl.push('transaction', {
      'txId': txId
    });
  }

  public goToAddress(addrStr: string): void {
    this.navCtrl.push('address', {
      'addrStr': addrStr
    });
  }
}
