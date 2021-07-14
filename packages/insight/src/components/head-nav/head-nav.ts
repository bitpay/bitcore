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
      .determineInputType(this.q)
      .subscribe(searchInputs => {
        if (searchInputs.length) {
          this.showSearch = false;
          this.searchProvider
            .search(searchInputs, this.chainNetwork)
            .subscribe(
              res => {
                this.processAllResponse(res);
              },
              err => {
                this.wrongSearch('Server error. Please try again');
                this.logger.error(err);
              }
            );
        } else {
          this.wrongSearch('Invalid search, please search for an address, transaction, or block');
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

      // Skip results screen if there is only one result
      const totalMatches = matches.addresses.length + matches.txs.length + matches.blocks.length;
      if (totalMatches === 1) {
        if (matches.addresses.length) {
          return this.redirProvider.redir('address', {
            addrStr: matches.addresses[0].address,
            chain: matches.addresses[0].chain,
            network: matches.addresses[0].network
          });
        } else if (matches.txs.length) {
          return this.redirProvider.redir('transaction', {
            txId: matches.txs[0].txid,
            chain: matches.txs[0].chain,
            network: matches.txs[0].network
          });
        } else {
          return this.redirProvider.redir('block-detail', {
            blockHash: matches.blocks[0].hash,
            chain: matches.blocks[0].chain,
            network: matches.blocks[0].network
          });
        }
      }

      this.redirProvider.redir('search', {
        matches,
        chain: this.chainNetwork.chain,
        network: this.chainNetwork.network
      });
    } else {
      let message = 'No matching records found!';
      if (this.chainNetwork.chain !== 'ALL') {
        // Give the user currency specific error since search is limited to one chain/network
        message = `No matching records found on the ${this.chainNetwork.chain} ${this.chainNetwork.network}. Select a different chain or try a different search`;
      }
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
      duration: 5000,
      position: 'top',
      showCloseButton: true
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
