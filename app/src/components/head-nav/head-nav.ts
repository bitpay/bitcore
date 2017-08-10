import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { ActionSheetController } from 'ionic-angular';

/**
 * Generated class for the HeadNavComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'head-nav',
  templateUrl: 'head-nav.html'
})
export class HeadNavComponent {

  public loading: boolean;
  @Input() public title: string;
  public q: string;
  public badQuery: boolean = false;

  constructor(private navCtrl: NavController, private http: Http, private api: ApiProvider, public currency: CurrencyProvider, public actionSheetCtrl: ActionSheetController) {
  }

  public search(): void {
    let apiPrefix: string = this.api.apiPrefix;

    this.http.get(apiPrefix + 'block/' + this.q).subscribe(
      function (data: any): void {
        this.resetSearch();
        console.log('block', data);
        let parsedData: any = JSON.parse(data._body);
        this.navCtrl.push('block-detail', {
          'blockHash': parsedData.hash
        });
      }.bind(this),
      () => {
        this.http.get(apiPrefix + 'tx/' + this.q).subscribe(
          function (data: any): void {
            this.resetSearch();
            console.log('tx', data);
            let parsedData: any = JSON.parse(data._body);
            this.navCtrl.push('transaction', {
              'txId': parsedData.txid
            });
          }.bind(this),
          () => {
            this.http.get(apiPrefix + 'addr/' + this.q).subscribe(
              function (data: any): void {
                this.resetSearch();
                console.log('addr', data);
                let parsedData: any = JSON.parse(data._body);
                this.navCtrl.push('address', {
                  'addrStr': parsedData.addrStr
                });
              }.bind(this),
              () => {
                this.http.get(apiPrefix + 'block-index/' + this.q).subscribe(
                  function (data: any): void {
                    this.resetSearch();
                    let parsedData: any = JSON.parse(data._body);
                    this.navCtrl.push('block-detail', {
                      'blockHash': parsedData.blockHash
                    });
                  }.bind(this),
                  function (): void {
                    this.loading = false;
                    this.reportBadQuery();
                  }.bind(this)
                );
              }
            );
          }
        );
      }
    );
  }

  /* tslint:disable:no-unused-variable */
  private reportBadQuery(): void {
    this.badQuery = true;
    console.log('badQuery', this.badQuery);

    setTimeout(
      function (): void {
        this.badQuery = false;
        console.log('badQuery', this.badQuery);
      }.bind(this),
      2000
    );
  };

  private resetSearch(): void {
    this.q = '';
    this.loading = false;
  }
  /* tslint:enable:no-unused-variable */

  public changeCurrency(): void {
    let actionSheet: any = this.actionSheetCtrl.create({
      title: 'Change Denomination',
      buttons: [
        {
          text: 'USD',
          handler: () => {
            this.currency.setCurrency('USD');
          }
        },
        {
          text: 'BTC',
          handler: () => {
            this.currency.setCurrency('BTC');
          }
        },
        {
          text: 'mBTC',
          handler: () => {
            this.currency.setCurrency('mBTC');
          }
        },
        {
          text: 'bits',
          handler: () => {
            this.currency.setCurrency('bits');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    actionSheet.present();
  }
}
