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
        name: 'Bitcoin',
        historicalRates: [],
        currentPrice: 0,
        averagePrice: 0,
        backgroundColor: 'rgba(69,99,246,1)',
        gradientBackgroundColor: 'rgba(69,99,246, 0.2)',
        ticks: {
          thirtyDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 500
            },
            xAxesTicks: {
              maxTicksLimit: 5,
              stepSize: 5,
            }
          },
          sevenDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 500
            },
            xAxesTicks: {
              maxTicksLimit: 7,
              stepSize: 1,
            }
          }
        },
      },
      'bch': {
        name: 'Bitcoin Cash',
        historicalRates: [],
        currentPrice: 0,
        averagePrice: 0,
        backgroundColor: 'rgba(69,99,246,1)',
        gradientBackgroundColor: 'rgba(69,99,246, 0.2)',
        ticks: {
          thirtyDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 25
            },
            xAxesTicks: {
              maxTicksLimit: 5,
              stepSize: 5,
            }
          },
          sevenDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 25,
            },
            xAxesTicks: {
              maxTicksLimit: 7,
              stepSize: 1,
            }
          }
      },
    }
  }
 
}


  public getHistoricalPriceForCurrencies(currency?: string, isoCode?: string, days?: number) {
    this.priceProvider.getHistoricalRate(currency, isoCode ,days).subscribe((response) => {
      this.coins[currency].currentPrice = response[(days-1)].rate; 
      this.coins[currency].historicalRates = response;
      this.priceChart.drawPriceChart(this.coins[currency], days);
    });
  }

  public goToPriceChartHandler() {
    this.showPriceChart = true;
    this.getHistoricalPriceForCurrencies(this.coin.toLowerCase(), 'USD', 7);
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
