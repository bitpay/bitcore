import { Component, Input, OnInit, ViewChild } from '@angular/core';
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
  @Input()
  public chainNetwork: ChainNetwork;
  public q: string;
  public redirTo: any;
  public params: any;

  constructor(
    public app: App,
    public currencyProvider: CurrencyProvider,
    public priceProvider: PriceProvider,
    public actionSheetCtrl: ActionSheetController,
    public popoverCtrl: PopoverController,
    public toastCtrl: ToastController,
    public searchProvider: SearchProvider,
    public redirProvider: RedirProvider,
    private navCtrl: NavController,
    private logger: Logger,
    private apiProvider: ApiProvider
  ) {}

  public ngOnInit(): void {
    this.params = {
      chain: this.chainNetwork.chain,
      network: this.chainNetwork.network
    };
  }

  public goHome(chainNetwork?): void {
    this.navCtrl.setRoot('home', {
      chain: chainNetwork ? chainNetwork.chain : 'ALL',
      network: chainNetwork ? chainNetwork.network : 'mainnet'
    });
  }

  public search(): void {
    this.q = this.q.replace(/\s/g, '');
    this.searchProvider
      .isInputValid(this.q, this.chainNetwork)
      .subscribe(inputDetails => {
        if (this.q !== '' && inputDetails.isValid) {
          this.showSearch = false;
          this.searchProvider
            .search(this.q, inputDetails.type, this.chainNetwork)
            .subscribe(
              res => {
                if (this.chainNetwork.chain !== 'ALL') {
                  const nextView = this.processResponse(res);
                  if (!_.includes(nextView, '')) {
                    this.params[nextView.type] = nextView.params;
                    this.redirTo = nextView.redirTo;
                    this.navCtrl.setRoot('home', this.params, {
                      animate: false
                    });
                    this.redirProvider.redir(this.redirTo, this.params);
                  } else {
                    const message = 'No matching records found!';
                    this.wrongSearch(message);
                    this.logger.info(message);
                  }
                } else {
                  this.processAllResponse(res);
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
      });
  }

  private processResponse(response) {
    if (response.addr) {
      return {
        redirTo: 'address',
        params: response.addr[0] ? response.addr[0].address : this.q,
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

  private processAllResponse(response) {
    const resFiltered = _.filter(response, o => {
      return (
        !_.isString(o) &&
        !(
          (o.addr && o.addr.length === 0) ||
          (o.block && o.block.length === 0) ||
          (o.tx && o.tx.length === 0)
        )
      );
    });

    if (resFiltered.length !== 0) {
      const matches = {
        blocks: [],
        txs: [],
        addresses: []
      };

      resFiltered.map(res => {
        res.block
          ? matches.blocks.push(res.block)
          : res.tx
          ? matches.txs.push(res.tx)
          : matches.addresses.push(res.addr[0]);
      });

      // ETH addresses doesn't have 'address' property
      if (matches.addresses.length > 0) {
        matches.addresses.forEach(addr => {
          if (!addr.address) {
            addr.address = this.q;
          }
        });
      }

      this.redirProvider.redir('search', {
        matches,
        chain: this.chainNetwork.chain,
        network: this.chainNetwork.network
      });
    } else {
      const message = 'No matching records found!';
      this.wrongSearch(message);
      this.logger.info(message);
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
      config: this.chainNetwork,
      currencySymbol: this.currencyProvider.getCurrency()
    });
    popover.present({
      ev: myEvent
    });
    popover.onDidDismiss(data => {
      if (!data) {
        return;
      } else if (data.chainNetwork !== this.chainNetwork) {
        this.apiProvider.changeNetwork(data.chainNetwork);
        this.setCurrency(data.chainNetwork);
        this.goHome(data.chainNetwork);
      } else if (data.currencySymbol !== this.currencyProvider.getCurrency()) {
        this.setCurrency(this.chainNetwork, data.currencySymbol);
      }
    });
  }

  private setCurrency(chainNetwork, currencySymbol?) {
    this.currencyProvider.setCurrency(chainNetwork, currencySymbol);
    this.priceProvider.setCurrency(currencySymbol);
  }

  public toggleSearch(): void {
    this.showSearch = !this.showSearch;
  }
}
