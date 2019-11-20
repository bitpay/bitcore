import { Component, Input, ViewChild } from '@angular/core';
import * as Chart from 'chart.js';
import { Nav, NavParams } from 'ionic-angular';
import * as _ from 'lodash';

@Component({
  selector: 'daily-transaction-chart',
  templateUrl: 'daily-transaction-chart.html'
})
export class DailyTransactionChartComponent {
  @ViewChild('lineCanvas') lineCanvas;
  @Input() coin: any;

  public lineChart;
  public isoCode;
  public coinName;
  public coinPrice: string;
  public coinTransactionPerDay: string;

  constructor(public nav: Nav, public navParams: NavParams) {}

  public numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  drawChart(coin, numOfDays, coinTransactionPerDay) {
    this.coinName = coin.name;
    this.coinTransactionPerDay = this.numberWithCommas(coinTransactionPerDay);
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
    const transactionCounts = [];
    const labels = [];

    _.forEach(coin.dailyTransactionCounts, (dailyTransactionCount, index) => {
      transactionCounts.push(dailyTransactionCount.transactionCount);
      const dateSplit = dailyTransactionCount.date.split('-');
      const month = dateSplit[1];

      const monthParsed = month.startsWith('0')
        ? parseInt(month.split('0')[1], 10)
        : parseInt(month, 10);

      labels.push(this.getMonthAbbrev(monthParsed - 1) + ' ' + dateSplit[2]);
    });

    const context: CanvasRenderingContext2D = (this.lineCanvas
      .nativeElement as HTMLCanvasElement).getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 275);
    gradient.addColorStop(0, coin.gradientBackgroundColor);
    gradient.addColorStop(0.35, 'rgba(255,255,255, 0.25)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    const graphTicks =
      numOfDays === 30 ? coin.ticks.thirtyDayTicks : coin.ticks.sevenDayTicks;

    const max = (Math.max(...transactionCounts) * 1.05).toFixed();
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
            ticks: { ...graphTicks.yAxesTicks, max }
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
          backgroundColor: 'rgba(69,99,246,0.5)',
          borderColor: 'rgba(69,99,246,1)',
          barPercentage: 0.5,
          barThickness: 6,
          maxBarThickness: 8,
          minBarLength: 2,
          data: transactionCounts,
          spanGaps: true,
          responsive: true,
          label: '# Transactions Per Day',
          legend: {
            display: false,
          }
        }
      ]
    };

    this.lineChart = new Chart(this.lineCanvas.nativeElement, {
      type: 'bar',
      data,
      options: {
        legend: {
          display: false,
        }
      }
    });
  }
}
