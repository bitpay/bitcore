import { Component, ViewChild } from '@angular/core';
import { Events, MenuController, Nav, Platform } from 'ionic-angular';
import { HomePage } from '../pages';
import { ApiProvider } from '../providers/api/api';
import { CurrencyProvider } from '../providers/currency/currency';

@Component({
  templateUrl: './app.html'
})
export class InsightApp {
  @ViewChild(Nav)
  public nav: Nav;

  private menu: MenuController;
  private platform: Platform;

  public rootPage: any;
  public pages: Array<{ title: string; component: any; icon: any; }>;

  constructor(
    platform: Platform,
    menu: MenuController,
    public currency: CurrencyProvider,
    public apiProvider: ApiProvider,
    public events: Events
  ) {
    this.menu = menu;
    this.platform = platform;

    this.initializeApp();

    // set our app's pages
    this.pages = [
      { title: 'Home', component: 'home', icon: 'home' },
      { title: 'Blocks', component: 'blocks', icon: 'logo-buffer' },
      { title: 'Broadcast Transaction', component: 'BroadcastTxPage', icon: 'ios-radio-outline' }
    ];
  }

  private initializeApp(): void {
    this.platform.ready().then(() => {
      this.rootPage = HomePage;
      this.subscribeRedirEvent();
    });
  }


  public subscribeRedirEvent() {
    this.events.subscribe('redirToEvent', data => {
      switch (data.redirTo) {
        case 'address':
          this.nav.push(data.redirTo, { addrStr: data.params })
          break;
        case 'transaction':
          this.nav.push(data.redirTo, { txId: data.params })
          break;
        case 'block-detail':
          this.nav.push(data.redirTo, { blockHash: data.params })
          break;
      }

    });
  }

  public openPage(page: any): void {
    // close the menu when clicking a link from the menu
    this.menu.close();
    // navigate to the new page if it is not the current page
    this.nav.push(page.component, {
      chain: this.apiProvider.networkSettings.value.selectedNetwork.chain,
      network: this.apiProvider.networkSettings.value.selectedNetwork.network
    });
  }
}
