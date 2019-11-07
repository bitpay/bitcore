import { Component, Input, ViewChild } from '@angular/core';
import * as Chart from 'chart.js';
import { Events, Nav, NavParams } from 'ionic-angular';
import * as _ from 'lodash';
import { ApiProvider, ChainNetwork } from '../../../providers/api/api';
import { CurrencyProvider } from '../../../providers/currency/currency';
import { PriceProvider } from '../../../providers/price/price';

@Component({
  selector: 'price-chart',
  templateUrl: 'price-chart.html'
})
export class PriceChartComponent {
  @ViewChild('lineCanvas') lineCanvas;
  @Input() coin: any;

  public lineChart;
  public isoCode;
  public coinName;
  public coinPrice: string;
  public chainNetwork: ChainNetwork;

  constructor(public nav: Nav, public navParams: NavParams, public events: Events) {}

  public numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  drawPriceChart(coin, numOfDays) {
    this.coinPrice = this.numberWithCommas(coin.currentPrice);
    this.events.publish('LatestPrice', { coin: coin.name, latestPrice: coin.currentPrice });
    this.drawCanvas(coin, numOfDays);
  }

  getMonthAbbrev(month) {
    const monthMapping = {
      0: 'Jan',
      1: 'Feb',
      2: 'Mar',
      3: 'Apr',
      4: 'May',
      5: 'June',
      6: 'Jul',
      7: 'Aug',
      8: 'Sept',
      9: 'Oct',
      10: 'Nov',
      11: 'Dec'
    };
    return monthMapping[month];
  }

  public dateToString(day) {
    const secondsInADay = 24 * 60 * 60;
    const date = new Date(Date.now() - day * secondsInADay * 1000);
    return this.getMonthAbbrev(date.getMonth()) + ' ' + date.getDate();
  }

  drawCanvas(coin, numOfDays) {
    const rates = [];
    const labels = [];

    _.forEach(coin.historicalRates, (historicalRates, index) => {
      rates.push(historicalRates.rate);
      labels.push(this.dateToString(index));
    });

    labels.reverse();

    const context: CanvasRenderingContext2D = (this.lineCanvas
      .nativeElement as HTMLCanvasElement).getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 275);
    gradient.addColorStop(0, coin.gradientBackgroundColor);
    gradient.addColorStop(0.35, 'rgba(255,255,255, 0.25)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    const graphTicks =
      numOfDays === 30 ? coin.ticks.thirtyDayTicks : coin.ticks.sevenDayTicks;

    const options = {
      maintainAspectRatio: false,
      legend: {
        display: false,
      },
      scales: {
        yAxes: [
          {
            display: true,
            gridLines: {
              display: true,
              drawBorder: true
            },
            ticks: graphTicks.yAxesTicks
          }
        ],
        xAxes: [
          {
            display: true,
            gridLines: {
              display: true,
              drawBorder: true
            },
            ticks: graphTicks.xAxesTicks
          }
        ]
      },
      layout: {
        padding: {
          bottom: 10,
          top: 10,
          left: 0,
          right: 2
        }
      }
    };

    const data = {
      labels,
      datasets: [
        {
          fill: true,
          lineTension: 0.3,
          backgroundColor: gradient,
          borderColor: coin.backgroundColor,
          borderCapStyle: 'round',
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: 'round',
          pointBorderColor: coin.backgroundColor,
          pointBackgroundColor: coin.backgroundColor,
          pointBorderWidth: 1,
          pointHoverRadius: 1,
          pointHoverBackgroundColor: coin.backgroundColor,
          pointHoverBorderColor: 'rgba(220,220,220,1)',
          pointHoverBorderWidth: 1,
          pointRadius: 1,
          data: rates,
          spanGaps: true,
          responsive: true,
          label: 'Market Price (USD)'
        }
      ]
    };

    this.lineChart = new Chart(this.lineCanvas.nativeElement, {
      type: 'line',
      data,
      options
    });
  }
}
