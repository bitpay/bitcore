import {
  Component,
  EventEmitter,
  Injectable,
  Input,
  Output
} from '@angular/core';
import * as bitcoreLib from 'bitcore-lib';
import * as bitcoreLibCash from 'bitcore-lib-cash';
import {
  ActionSheetController,
  App,
  NavController,
  PopoverController,
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

@Injectable()
@Component({
  selector: 'head-nav',
  templateUrl: 'head-nav.html'
})
export class HeadNavComponent {
  @Output()
  public updateView = new EventEmitter<ChainNetwork>();
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
    public currency: CurrencyProvider,
    public price: PriceProvider,
    public actionSheetCtrl: ActionSheetController,
    public popoverCtrl: PopoverController,
    public toastCtrl: ToastController,
    private logger: Logger,
    public searchProvider: SearchProvider,
    public redirProvider: RedirProvider
  ) {
    this.config = this.apiProvider.getConfig();
    this.params = {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    };
  }

  public search(): void {
    this.showSearch = false;
    this.q = this.q.replace(/\s/g, '');
    const inputDetails = this.searchProvider.isInputValid(this.q);

    if (this.q !== '' && inputDetails.isValid) {
      this.searchProvider.search(this.q, inputDetails.type).subscribe(
        res => {
          if (_.isArray(res)) {
            const index = _.findIndex(res, o => {
              return o !== null;
            });
            if (index === 0) {
              this.redirTo = 'block-detail';
              this.params['blockHash'] = res[0].json().hash;
            } else {
              this.redirTo = 'transaction';
              this.params['txId'] = res[1].json().txid;
            }
          } else {
            this.redirTo = 'address';
            this.params['addrStr'] = res.json()[0].address;
          }
          this.redirProvider.redir(this.redirTo, this.params);
        },
        err => {
          this.resetSearch();
          this.loading = false;
          this.reportBadQuery('Server error. Please try again');
          this.logger.error(err);
        }
      );
    } else {
      this.resetSearch();
      this.loading = false;
      this.reportBadQuery('No matching records found!');
    }
  }

  /* tslint:disable:no-unused-variable */
  private reportBadQuery(message): void {
    this.presentToast(message);
    this.logger.info(message);
  }

  private presentToast(message): void {
    const toast: any = this.toastCtrl.create({
      message,
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
          this.navCtrl.setRoot('home', {
            chain: this.config.chain,
            network: this.config.network
          });
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
