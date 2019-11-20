import { Component, Injectable, ViewChild } from '@angular/core';
import { Events, IonicPage, Nav, NavParams } from 'ionic-angular';
import _ from 'lodash';
import { LatestBlocksComponent } from '../../components/latest-blocks/latest-blocks';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { PriceProvider } from '../../providers/price/price';
import { TxsProvider } from '../../providers/transactions/transactions';

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
  @ViewChild('priceChart')
  priceChart;
  @ViewChild('dailyTxChart') dailyTxChart;

  public latestBlocks: LatestBlocksComponent;
  public coin: string;
  public chain: string;
  public showPriceChart: boolean;
  public showBlocks: boolean;
  public showDailyTxChart: boolean;
  public currentView: string;
  public chainNetwork: ChainNetwork;
  public network: string;
  public coins: any;
  public currentPrice: number;

  constructor(
    public nav: Nav,
    public navParams: NavParams,
    private apiProvider: ApiProvider,
    private priceProvider: PriceProvider,
    public events: Events,
    public currencyProvider: CurrencyProvider,
    public transactionProvider: TxsProvider,
  ) {
    const chain = navParams.get('chain') || this.apiProvider.getConfig().chain;
    const network: string =
      navParams.get('network') || this.apiProvider.getConfig().network;


    this.coin = chain;
    this.showPriceChart = false;
    this.showDailyTxChart = false;

    this.currentView = 'blocks';
    this.chainNetwork = {
      chain,
      network
    };

    const yValueCallback = value => {
      return this.currentView === 'price-chart'
        ? '$' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    this.apiProvider.changeNetwork(this.chainNetwork);
    this.currencyProvider.setCurrency(this.chainNetwork);
    this.priceProvider.setCurrency();
    this.coins = {
      btc: {
        name: 'Bitcoin',
        historicalRates: [],
        dailyTransactionCounts: [],
        currentPrice: 0,
        averagePrice: 0,
        lastNumberOfTransactionsConfirmed: 0,
        backgroundColor: 'rgba(69,99,246,1)',
        gradientBackgroundColor: 'rgba(69,99,246, 0.2)',
        ticks: {
          thirtyDayTicks: {
            callback: value => {
              return this.numberWithCommas(value);
            },
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 500,
              callback: value => yValueCallback(value)
            },
            xAxesTicks: {
              maxTicksLimit: 5,
              stepSize: 5
            }
          },
          sevenDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 500,
              callback: value => yValueCallback(value)
            },
            xAxesTicks: {
              maxTicksLimit: 7,
              stepSize: 1
            }
          }
        }
      },
      bch: {
        name: 'Bitcoin Cash',
        historicalRates: [],
        dailyTransactionCounts: [],
        currentPrice: 0,
        averagePrice: 0,
        backgroundColor: 'rgba(69,99,246,1)',
        gradientBackgroundColor: 'rgba(69,99,246, 0.2)',
        ticks: {
          thirtyDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 25,
              callback: value => yValueCallback(value)
            },
            xAxesTicks: {
              maxTicksLimit: 5,
              stepSize: 5
            }
          },
          sevenDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 25,
              callback: value => yValueCallback(value)
            },
            xAxesTicks: {
              maxTicksLimit: 7,
              stepSize: 1
            }
          }
        }
      },
      eth: {
        name: 'Ethereum',
        historicalRates: [],
        dailyTransactionCounts: [],
        currentPrice: 0,
        averagePrice: 0,
        backgroundColor: 'rgba(69,99,246,1)',
        gradientBackgroundColor: 'rgba(69,99,246, 0.2)',
        ticks: {
          thirtyDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 25,
              callback: value => yValueCallback(value)
            },
            xAxesTicks: {
              maxTicksLimit: 5,
              stepSize: 5
            }
          },
          sevenDayTicks: {
            yAxesTicks: {
              maxTicksLimit: 10,
              stepSize: 25,
              callback: value => yValueCallback(value)
            },
            xAxesTicks: {
              maxTicksLimit: 7,
              stepSize: 1
            }
          }
        }
      }
    };
  }

  public numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  private switchView(view) {
    this.currentView = view;
  }

  public getDailyTransactionCount(currency?: string, numOfDays?: number) {
    this.transactionProvider
      .getDailyTransactionHistory(this.chainNetwork)
      .subscribe((response: any) => {
        this.coins[currency].dailyTransactionCounts = response.results.slice(
          response.results.length - 1 - numOfDays,
          response.results.length - 1
        );
        this.coins[currency].lastNumberOfTransactionsConfirmed =
          response.results[response.results.length - 1].transactionCount;

        this.dailyTxChart.drawChart(
          this.coins[currency],
          7,
          this.coins[currency].lastNumberOfTransactionsConfirmed
        );
      });
  }

  public getHistoricalPriceForCurrencies(
    currency?: string,
    isoCode?: string,
    days?: number
  ) {
    this.priceProvider
      .getHistoricalRate(currency, isoCode, days)
      .subscribe((response: any) => {
        this.coins[currency].currentPrice = response[days - 1].rate;
        this.currentPrice = this.coins[this.chainNetwork.chain.toLowerCase()].currentPrice;
        this.coins[currency].historicalRates = response;
        this.priceChart.drawPriceChart(this.coins[currency], days);
      });
  }

  public goToPriceChartHandler() {
    this.getHistoricalPriceForCurrencies(this.coin.toLowerCase(), 'USD', 7);
  }

  public drawDailyTxChartHandler() {
    this.getDailyTransactionCount(this.coin.toLowerCase(), 7);
  }

  public goToBlocks() {
    this.switchView('blocks');
  }

  public openPage(page: string): void {
    this.nav.push(page, {
      chain: this.chain,
      network: this.network
    });
  }
}
