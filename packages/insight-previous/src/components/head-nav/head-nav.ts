import { Component, Input, OnInit, ViewChild } from '@angular/core';
import * as bitcoreLib from 'bitcore-lib';
import * as bitcoreLibCash from 'bitcore-lib-cash';
import {
  ActionSheetController,
  App,
  NavController,
  PopoverController,
  Searchbar,
  ToastController
} from 'ionic-angular';
import * as _ from 'lodash';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { Logger } from '../../providers/logger/logger';
import { PriceProvider } from '../../providers/price/price';
import { RedirProvider } from '../../providers/redir/redir';
import { SearchProvider } from '../../providers/search/search';
import { DenominationComponent } from '../denomination/denomination';

@Component({
  selector: 'head-nav',
  templateUrl: 'head-nav.html'
})
export class HeadNavComponent implements OnInit {
  @ViewChild('searchbar') searchbar: Searchbar;
  public showSearch = false;
  public loading: boolean;
  @Input()
  public title: string;
  public q: string;
  public config: ChainNetwork;
  public redirTo: any;
  public params: any;

  constructor(
    private navCtrl: NavController,
    private apiProvider: ApiProvider,
    public app: App,
    public currencyProvider: CurrencyProvider,
    public priceProvider: PriceProvider,
    public actionSheetCtrl: ActionSheetController,
    public popoverCtrl: PopoverController,
    public toastCtrl: ToastController,
    private logger: Logger,
    public searchProvider: SearchProvider,
    public redirProvider: RedirProvider
  ) {}

  public ngOnInit(): void {
    this.config = this.apiProvider.getConfig();
    this.params = {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    };
  }

  public goHome(): void {
    this.navCtrl.setRoot('home', {
      chain: this.config.chain,
      network: this.config.network
    });
  }

  public search(): void {
    this.q = this.q.replace(/\s/g, '');
    const inputDetails = this.searchProvider.isInputValid(this.q);

    if (this.q !== '' && inputDetails.isValid) {
      this.showSearch = false;
      this.searchProvider.search(this.q, inputDetails.type).subscribe(
        res => {
          const nextView = this.processResponse(res);
          if (!_.includes(nextView, '')) {
            this.params[nextView.type] = nextView.params;
            this.redirTo = nextView.redirTo;
            this.navCtrl.setRoot('home', this.params, { animate: false });
            this.redirProvider.redir(this.redirTo, this.params);
          } else {
            const message = 'No matching records found!';
            this.wrongSearch(message);
            this.logger.info(message);
          }
        },
        err => {
          this.wrongSearch('Server error. Please try again');
          this.logger.error(err);
        }
      );
    } else {
      this.wrongSearch('No matching records found!');
    }
  }

  private processResponse(response) {
    if (response.addr) {
      return {
        redirTo: 'address',
        params: response.addr[0] ? response.addr[0].address : [],
        type: 'addrStr'
      };
    } else {
      return _.reduce(
        response,
        (result, value) => {
          if (value.tx) {
            result = {
              redirTo: 'transaction',
              params: value.tx.txid,
              type: 'txId'
            };
          } else if (value.block) {
            result = {
              redirTo: 'block-detail',
              params: value.block.hash,
              type: 'blockHash'
            };
          }
          return result;
        },
        { redirTo: '', params: '', type: '' }
      );
    }
  }

  private wrongSearch(message: string): void {
    this.loading = false;
    this.presentToast(message);
    setTimeout(() => {
      this.searchbar.setFocus();
    }, 150);
  }

  private presentToast(message): void {
    const toast: any = this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top'
    });
    toast.present();
  }

  public changeCurrency(myEvent: any): void {
    const popover: any = this.popoverCtrl.create(DenominationComponent, {
      config: this.config,
      currencySymbol: this.currencyProvider.getCurrency()
    });
    popover.present({
      ev: myEvent
    });
    popover.onDidDismiss(data => {
      if (!data) {
        return;
      } else if (data.chainNetwork !== this.config) {
        this.apiProvider.changeNetwork(data.chainNetwork);
        this.config = this.apiProvider.getConfig();
        this.setCurrency(data.currencySymbol);
        this.goHome();
      } else if (data.currencySymbol !== this.currencyProvider.getCurrency()) {
        this.setCurrency(data.currencySymbol);
      }
    });
  }

  private setCurrency(currencySymbol) {
    this.currencyProvider.setCurrency(currencySymbol);
    this.priceProvider.setCurrency(currencySymbol);
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
    if (this.isValidBlockOrTx(inputValue)) {
      return true;
    } else if (this.isValidAddress(inputValue)) {
      return true;
    } else if (this.isValidBlockIndex(inputValue)) {
      return true;
    } else {
      return false;
    }
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
