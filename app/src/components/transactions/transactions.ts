import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Http } from '@angular/http';

/**
 * Generated class for the TransactionsComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'transactions',
  templateUrl: 'transactions.html'
})
export class TransactionsComponent {

  public loading: boolean = true;
  @Input() public queryType: string;
  @Input() public queryValue: string;
  public transactions: any = [];

  constructor(private navCtrl: NavController, private http: Http) {
  }

  private ngOnInit(): void {
    let apiPrefix: string = 'http://localhost:3001/insight-api/';

    let url: string = apiPrefix + 'txs?' + this.queryType + '=' + this.queryValue;

    this.http.get(url).subscribe(
      (data) => {
        this.transactions = JSON.parse(data['_body']);
        this.loading = false;

        this.transactions.txs.forEach((tx) => {
          console.log('tx is', tx);
        });
      },
      (err) => {
        console.log('err is', err);
        this.loading = false;
      }
    );
  }

  public getAddress(vout: any): string {
    if (vout.scriptPubKey && vout.scriptPubKey.addresses) {
      return vout.scriptPubKey.addresses[0];
    } else {
      return 'Unparsed address';
    }
  }

  public goToTx(txId: string): void {
    console.log('tx', txId);
    /*
    this.navCtrl.push('tx', {
      'tx': txId 
    });
     */
  }

  public goToAddress(addrStr: string): void {
    this.navCtrl.push('address', {
      'addrStr': addrStr
    });
  }
}
