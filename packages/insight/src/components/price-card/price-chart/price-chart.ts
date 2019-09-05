import { Nav, NavParams } from 'ionic-angular';
import { Component, Input, ViewChild } from '@angular/core';
import * as Chart from 'chart.js';
import * as _ from 'lodash';
import { CurrencyProvider } from '../../../providers/currency/currency';
import { ChainNetwork, ApiProvider } from '../../../providers/api/api';
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
    public chainNetwork: ChainNetwork;


    constructor(private currencyProvider: CurrencyProvider,
        public nav: Nav,
        public navParams: NavParams,
        private priceProvider: PriceProvider,
        private apiProvider: ApiProvider,
        ) {
            
        }

    // ngAfterViewInit() {
    //     console.log(this.coin);
    //     this.drawCanvas(this.coin);
    // }
    
    drawPriceChart(coin) {
      this.drawCanvas(coin);
    }

    drawCanvas(coin) {
        let rates = [];
        let labels  = [];

        _.forEach(coin.historicalRates, (historicalRates, i) => {
            rates.push(historicalRates.rate);
            labels.push(`${i}`);
        });

        const context: CanvasRenderingContext2D = (this.lineCanvas.nativeElement as HTMLCanvasElement).getContext('2d');
        let gradient = context.createLinearGradient(0, 0, 0, 275);
        gradient.addColorStop(0, coin.gradientBackgroundColor);
        gradient.addColorStop(0.35, 'rgba(255,255,255, 0.25)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        const options = {
            legend: {
                display: true
            }, 
            scales: {
                yAxes: [
                    {   
                        display: true,
                        gridLines: {
                            display: true,
                            drawBorder: true,
                        },
                        ticks: {
                            maxTicksLimit: 10,
                            stepSize: 250
                        }
                    }
                ],
                xAxes: [
                    {
                        display: true,
                        gridLines: {
                            display: true,
                            drawBorder: true,
                        },
                        ticks: {
                            maxTicksLimit: 30,
                            stepSize: 1,
                        }

                    }
                ],
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
            }
          ],
        };

        this.lineChart = new Chart(this.lineCanvas.nativeElement, {
            type: 'line',
            data,
            options,
        });
    }

}