import { Component, ViewChild } from '@angular/core';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';
import { MenuController, Nav, Platform } from 'ionic-angular';
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
  private splash: SplashScreen;
  private status: StatusBar;

  public rootPage: any;
  public pages: Array<{ title: string; component: any }>;

  constructor(
    platform: Platform,
    menu: MenuController,
    public currency: CurrencyProvider,
    public apiProvider: ApiProvider
  ) {
    this.menu = menu;
    this.platform = platform;

    this.initializeApp();

    // set our app's pages
    this.pages = [
      { title: 'Home', component: 'home' },
      { title: 'Blocks', component: 'blocks' },
      { title: 'Broadcast Transaction', component: 'BroadcastTxPage' }
    ];
  }

  private initializeApp(): void {
    this.platform.ready().then(() => {
      this.rootPage = HomePage;
      // cordova ready
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
