import { Component, ViewChild } from '@angular/core';
import { Events, Nav, Platform } from 'ionic-angular';
import { HomePage } from '../pages';
import { ApiProvider } from '../providers/api/api';
import { CurrencyProvider } from '../providers/currency/currency';

@Component({
  templateUrl: './app.html'
})
export class InsightApp {
  @ViewChild('content')
  public nav: Nav;

  private platform: Platform;

  private chain: string;
  private network: string;

  public rootPage: any;
  public activePage: any;
  public pages: Array<{ title: string; component: any; icon: any; }>;

  constructor(
    platform: Platform,
    public currency: CurrencyProvider,
    public apiProvider: ApiProvider,
    public events: Events
  ) {
    this.platform = platform;

    this.initializeApp();

    this.pages = [
      { title: 'Home', component: 'home', icon: 'home' },
      { title: 'Blocks', component: 'blocks', icon: 'logo-buffer' },
      { title: 'Broadcast Transaction', component: 'broadcast-tx', icon: 'ios-radio-outline' }
    ];

    this.apiProvider.networkSettings.subscribe((d) => {
      this.chain = d.selectedNetwork.chain;
      this.network = d.selectedNetwork.network;
    });
    this.activePage = this.pages[0];
  }

  private initializeApp(): void {
    this.platform.ready().then(() => {
      this.nav.setRoot('home', {
        chain: this.chain,
        network: this.network
      });
      this.subscribeRedirEvent();
    });
  }

  public subscribeRedirEvent() {
    this.events.subscribe('redirToEvent', data => {
      this.nav.push(data.redirTo, data.params);
    });
  }

  public openPage(page: any): void {
    this.menu.close();
    if (page !== this.activePage) {
      this.nav.setRoot(page.component, {
        chain: this.chain,
        network: this.network
      });
      this.activePage = page;
    }
  }
}
