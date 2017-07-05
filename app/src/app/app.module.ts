import { NgModule, ErrorHandler }                   from '@angular/core';
import { BrowserModule }                            from '@angular/platform-browser';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { StatusBar }                                from '@ionic-native/status-bar';
import { SplashScreen }                             from '@ionic-native/splash-screen';
import { InsightApp }                               from './app.component';
import {
  PagesModule,
  BlocksPage,
  BroadcastTxPage,
  NodeStatusPage,
  VerifyMessagePage,
} from '../pages';
import { ClickersService, StorageService }          from '../services';

@NgModule({
  declarations: [
    InsightApp,
  ],
  imports: [
    BrowserModule,
    PagesModule,
    IonicModule.forRoot(InsightApp),
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    InsightApp,
    BlocksPage,
    BroadcastTxPage,
    NodeStatusPage,
    VerifyMessagePage,
  ],
  providers: [
    StatusBar,
    SplashScreen,
    ClickersService,
    StorageService,
    {provide: ErrorHandler, useClass: IonicErrorHandler},
  ],
})

export class AppModule {}
