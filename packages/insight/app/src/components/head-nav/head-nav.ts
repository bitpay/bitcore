import { Component } from '@angular/core';
import { Input } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Http } from '@angular/http';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { ActionSheetController } from 'ionic-angular';
import { PopoverController } from 'ionic-angular';
import { ToastController } from 'ionic-angular';
import { DenominationComponent } from '../denomination/denomination';
import { PriceProvider } from '../../providers/price/price';
import { App } from 'ionic-angular/components/app/app';

/** * Generated class for the HeadNavComponent component.
 *
 * See https://angular.io/docs/ts/latest/api/core/index/ComponentMetadata-class.html
 * for more info on Angular Components.
 */
@Component({
  selector: 'head-nav',
  templateUrl: 'head-nav.html'
})
export class HeadNavComponent {
  public showSearch: boolean = false;
  public loading: boolean;
  @Input() public title: string;
  public q: string;

  constructor(
    private navCtrl: NavController,
    private http: Http,
    private apiProvider: ApiProvider,
    public app: App,
    public currency: CurrencyProvider,
    public price: PriceProvider,
    public actionSheetCtrl: ActionSheetController,
    public popoverCtrl: PopoverController,
    public toastCtrl: ToastController
  ) {}

  public search(): void {
    this.showSearch = false;
    let apiPrefix: string = this.apiProvider.getUrl();

    this.http.get(apiPrefix + '/block/' + this.q).subscribe(
      (data: any): void => {
        this.resetSearch();
        console.log('block', data);
        let parsedData: any = JSON.parse(data._body);
        this.navCtrl.push('block-detail', {
          chain: this.apiProvider.selectedChain,
          network: this.apiProvider.selectedNetwork,
          blockHash: parsedData.hash
        });
      },
      () => {
        this.http.get(apiPrefix + '/tx/' + this.q).subscribe(
          function(data: any): void {
            this.resetSearch();
            console.log('tx', data);
            let parsedData: any = JSON.parse(data._body);
            this.navCtrl.push('transaction', {
              chain: this.apiProvider.selectedChain,
              network: this.apiProvider.selectedNetwork,
              txId: parsedData[0].txid
            });
          },
          () => {
            this.http.get(apiPrefix + '/address/' + this.q).subscribe(
              (data: any): void => {
                this.resetSearch();
                console.log('addr', data);
                let parsedData: any = JSON.parse(data._body);
                this.navCtrl.push('address', {
                  chain: this.apiProvider.selectedChain,
                  network: this.apiProvider.selectedNetwork,
                  addrStr: parsedData[0].address
                });
              },
              () => {
                this.http.get(apiPrefix + 'block-index/' + this.q).subscribe(
                  (data: any): void => {
                    this.resetSearch();
                    console.log('height', data);
                    let parsedData: any = JSON.parse(data._body);
                    this.navCtrl.push('block-detail', {
                      chain: this.apiProvider.selectedChain,
                      network: this.apiProvider.selectedNetwork,
                      blockHash: parsedData.blockHash
                    });
                  },
                  () => {
                    this.loading = false;
                    this.reportBadQuery();
                  }
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
    this.presentToast();
  }

  private presentToast(): void {
    const toast: any = this.toastCtrl.create({
      message: 'No matching records found!',
      duration: 3000,
      position: 'top'
    });
    toast.present();
  }

  private resetSearch(): void {
    this.q = '';
    this.loading = false;
  }
  /* tslint:enable:no-unused-variable */

  public changeCurrency(myEvent: any): void {
    let popover: any = this.popoverCtrl.create(DenominationComponent);
    popover.present({
      ev: myEvent
    });
  }

  public toggleSearch(): void {
    this.showSearch = !this.showSearch;
  }
}
