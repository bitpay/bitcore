import { ErrorHandler, NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';
import { BrowserModule } from '@angular/platform-browser';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { Logger } from '../../src/providers/logger/logger';
import { BlocksPage, HomePage, PagesModule } from '../pages';
import { ApiProvider } from '../providers/api/api';
import { BlocksProvider } from '../providers/blocks/blocks';
import { CurrencyProvider } from '../providers/currency/currency';
import { DefaultProvider } from '../providers/default/default';
import { PriceProvider } from '../providers/price/price';
import { RedirProvider } from '../providers/redir/redir';
import { SearchProvider } from '../providers/search/search';
import { TxsProvider } from '../providers/transactions/transactions';
import { InsightApp } from './app.component';

@NgModule({
  declarations: [InsightApp],
  imports: [
    BrowserModule,
    HttpModule,
    PagesModule,
    IonicModule.forRoot(InsightApp, {
      mode: 'md',
      animate: false
    })
  ],
  bootstrap: [IonicApp],
  entryComponents: [InsightApp, HomePage, BlocksPage],
  providers: [
    { provide: ErrorHandler, useClass: IonicErrorHandler },
    ApiProvider,
    CurrencyProvider,
    BlocksProvider,
    TxsProvider,
    DefaultProvider,
    PriceProvider,
    SearchProvider,
    RedirProvider,
    Logger
  ]
})
export class AppModule {}
