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

  private chain: string;
  private network: string;

  public rootPage: any;
  public pages: Array<{ title: string; component: any; icon: any }>;

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
      { title: 'Broadcast Transaction', component: 'broadcast-tx', icon: 'ios-radio-outline' }
    ];

    this.apiProvider.networkSettings.subscribe((d) => {
      console.log('[app.component.ts:43]',d); /* TODO */
      this.chain = d.selectedNetwork.chain;
      this.network = d.selectedNetwork.network;
    });
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
    // close the menu when clicking a link from the menu
    this.menu.close();
    // navigate to the new page if it is not the current page
    this.nav.push(page.component, {
      chain: this.chain,
      network: this.network
    });
  }
}
