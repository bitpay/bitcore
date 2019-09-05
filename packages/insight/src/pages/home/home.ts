import { Component, Injectable, ViewChild } from '@angular/core';
import { Events, IonicPage, Nav, NavParams } from 'ionic-angular';
import { LatestBlocksComponent } from '../../components/latest-blocks/latest-blocks';
import { PriceChartComponent } from '../../components/price-card/price-chart/price-chart';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { PriceProvider } from '../../providers/price/price';
import _ from 'lodash';

@Injectable()
@IonicPage({
  name: 'home',
  segment: ':chain/:network/home'
})
@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  @ViewChild('latestBlocks')
  @ViewChild('priceChart') priceChart

  public latestBlocks: LatestBlocksComponent;
  public priceChart: PriceChartComponent;
  public coin: string;
  public chain: string;
  public showPriceChart: boolean;
  public chainNetwork: ChainNetwork;
  public network: string;
  public coins: any;
  
  constructor(
    public nav: Nav,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider,
    public events: Events,
    public currencyProvider: CurrencyProvider
  ) {
    const chain=
      navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      navParams.get('network') || this.apiProvider.getConfig().network;
    
    this.coin = chain;
    this.showPriceChart = false;

    this.chainNetwork = {
      chain,
      network
    };
    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency(this.chainNetwork);
    this.priceProvider.setCurrency();
    this.coins = {
      'btc': {
        historicalRates: [],
        currentPrice: 0,
        averagePrice: 0,
        backgroundColor: 'rgba(69,99,246,1)',
        gradientBackgroundColor: 'rgba(247,146,26, 0.2)',
        name: 'Bitcoin',
      },
      'bch': {
        historicalRates: [],
        currentPrice: 0,
        averagePrice: 0,
        backgroundColor: 'rgba(69,99,246,1)',
        gradientBackgroundColor: 'rgba(47,207,110, 0.2)',
        name: 'Bitcoin Cash',
      }
    };
    
    this.getHistoricalPriceForCurrencies(chain.toLowerCase(), 'USD', 30);
  }


  public getHistoricalPriceForCurrencies(currency?: string, isoCode?: string, days?: number) {
    this.priceProvider.getHistoricalRate(currency, isoCode ,days).subscribe((response) => {
      this.coins[currency].historicalRates = response;
      this.priceChart.drawPriceChart(this.coins[currency]);
    });
  }

  public goToPriceChartHandler() {
    this.showPriceChart = true;
    this.getHistoricalPriceForCurrencies(this.coin.toLowerCase(), 'USD', 30);
  }

  public goToBlocks() {
    this.showPriceChart = false;
  }

  public openPage(page: string): void {
    this.nav.push(page, {
      chain: this.chain,
      network: this.network
    });
  }
}
