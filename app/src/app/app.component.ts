import { Component, ViewChild } from '@angular/core';
import { Platform, MenuController, Nav } from 'ionic-angular';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';
import {
  HomePage
} from '../pages';

@Component({
  templateUrl: './app.html'
})
export class InsightApp {
  @ViewChild(Nav) public nav: Nav;

  private menu: MenuController;
  private platform: Platform;
  private splash: SplashScreen;
  private status: StatusBar;

  public rootPage: any;
  public pages: Array<{ title: string; component: any }>;

  constructor(
    platform: Platform,
    menu: MenuController,
    splash: SplashScreen,
    status: StatusBar
  ) {
    this.menu = menu;
    this.platform = platform;
    this.splash = splash;
    this.status = status;

    this.rootPage = HomePage;
    this.initializeApp();

    // set our app's pages
    this.pages = [
      { title: 'Home', component: HomePage },
      { title: 'Blocks', component: 'blocks' },
      { title: 'Broadcast Transaction', component: 'BroadcastTxPage' }
      // { title: 'Verify Signed Message', component: VerifyMessagePage },
      // { title: 'Node Status', component: NodeStatusPage }
    ];
  }

  private initializeApp(): void {
    this.platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      this.status.styleDefault();
      this.splash.hide();
    });
  }

  public openPage(page: any): void {
    // close the menu when clicking a link from the menu
    this.menu.close();
    // navigate to the new page if it is not the current page
    this.nav.setRoot(page.component);
  }
}
