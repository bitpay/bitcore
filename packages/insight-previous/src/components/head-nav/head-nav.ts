import { Component, EventEmitter, Output } from '@angular/core';
import { Input } from '@angular/core';
import { Http } from '@angular/http';
import * as bitcoreLib from 'bitcore-lib';
import * as bitcoreLibCash from 'bitcore-lib-cash';
import { PopoverController } from 'ionic-angular';
import { NavController } from 'ionic-angular';
import { ToastController } from 'ionic-angular';
import { ActionSheetController } from 'ionic-angular';
import { App } from 'ionic-angular/components/app/app';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { PriceProvider } from '../../providers/price/price';
import { DenominationComponent } from '../denomination/denomination';
@Component({
  selector: 'head-nav',
  templateUrl: 'head-nav.html'
})
export class HeadNavComponent {
  @Output() updateView = new EventEmitter<ChainNetwork>();
  public showSearch = false;
  public loading: boolean;
  @Input()
  public title: string;
  public q: string;
  public config: ChainNetwork;

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
  ) {
    this.config = this.apiProvider.getConfig();
  }

  public search(): void {
    this.showSearch = false;
    const apiPrefix: string = this.apiProvider.getUrl();
    this.q = this.q.replace(/\s/g, '');
    if (this.isInputValid(this.q)) {
      this.http.get(apiPrefix + '/block/' + this.q).subscribe(
        (data: any): void => {
          this.resetSearch();
          console.log('block', data);
          const parsedData: any = JSON.parse(data._body);
          this.navCtrl.push('block-detail', {
            chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
            network: this.apiProvider.networkSettings.value.selectedNetwork
              .network,
            blockHash: parsedData.hash
          });
        },
        () => {
          this.http.get(apiPrefix + '/tx/' + this.q).subscribe(
            (data: any): void => {
              this.resetSearch();
              console.log('tx', data);
              const parsedData: any = JSON.parse(data._body);
              this.navCtrl.push('transaction', {
                chain: this.apiProvider.networkSettings.value.selectedNetwork
                  .chain,
                network: this.apiProvider.networkSettings.value.selectedNetwork
                  .network,
                txId: parsedData[0].txid
              });
            },
            () => {
              this.http.get(apiPrefix + '/address/' + this.q).subscribe(
                (data: any): void => {
                  const addrStr = this.q;
                  this.resetSearch();
                  console.log('addr', data);
                  const parsedData: any = JSON.parse(data._body);
                  this.navCtrl.push('address', {
                    chain: this.apiProvider.networkSettings.value.selectedNetwork
                      .chain,
                    network: this.apiProvider.networkSettings.value
                      .selectedNetwork.network,
                    addrStr
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
    } else {
      this.resetSearch();
      this.loading = false;
      this.reportBadQuery();
    }

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
    const popover: any = this.popoverCtrl.create(DenominationComponent);
    popover.present({
      ev: myEvent
    });
    popover.onDidDismiss(data => {
      if (data) {
        if (JSON.stringify(data) === JSON.stringify(this.config)) {
          return;
        }
        this.apiProvider.changeNetwork(data);
        this.config = this.apiProvider.getConfig();
        if (this.navCtrl.getActive().component.name === 'HomePage') {
          this.updateView.next(data);
        } else {
          this.navCtrl.setRoot('home', { chain: this.config.chain, network: this.config.network });
        }
      }
    });
  }

  public toggleSearch(): void {
    this.showSearch = !this.showSearch;
  }

  public extractAddress(address: string): string {
    const extractedAddress = address
      .replace(/^(bitcoincash:|bchtest:|bitcoin:)/i, '')
      .replace(/\?.*/, '');
    return extractedAddress || address;
  }

  public isInputValid(inputValue): boolean {
    if (this.isValidBlockOrTx(inputValue)) { return true; }
    else if (this.isValidAddress(inputValue)) { return true; }
    else if (this.isValidBlockIndex(inputValue)) { return true; }
    else { return false; }
  }

  private isValidBlockOrTx(inputValue): boolean {
    const regexp = /^[0-9a-fA-F]{64}$/;
    if (regexp.test(inputValue)) {
      return true;
    } else {
      return false;
    }
  }

  private isValidAddress(inputValue): boolean {
    const coin = this.config.chain;
    const network = this.config.network;
    const addr = this.extractAddress(inputValue);

    if (coin.toLowerCase() === 'btc' && network === 'mainnet') {
      return this.isValidBitcoinMainnetAddress(addr);
    } else if (coin.toLowerCase() === 'btc' && network === 'testnet') {
      return this.isValidBitcoinTestnetAddress(addr);
    } else if (coin.toLowerCase() === 'bch' && network === 'mainnet') {
      return (
        this.isValidBitcoinCashMainnetAddress(addr) ||
        this.isValidBitcoinCashLegacyMainnetAddress(addr)
      );
    }
  }

  private isValidBitcoinMainnetAddress(data: string): boolean {
    return !!bitcoreLib.Address.isValid(data, 'mainnet');
  }
  private isValidBitcoinTestnetAddress(data: string): boolean {
    return !!bitcoreLib.Address.isValid(data, 'testnet');
  }

  private isValidBitcoinCashLegacyMainnetAddress(data: string): boolean {
    return !!bitcoreLib.Address.isValid(data, 'mainnet');
  }

  private isValidBitcoinCashMainnetAddress(data: string): boolean {
    return !!bitcoreLibCash.Address.isValid(data, 'mainnet');
  }

  private isValidBlockIndex(inputValue): boolean {
    return isFinite(inputValue);
  }
}
