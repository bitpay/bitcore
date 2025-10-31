import {FC, useEffect, useRef, useState} from 'react';
import {useApi} from 'src/api/api';
import {Chart as ChartJS} from 'chart.js';
import {colorCodes} from 'src/utilities/constants';
import {BitcoinBlockType} from 'src/utilities/models';
import styled, { useTheme } from 'styled-components';
import { getName } from 'src/utilities/helper-methods';
import Dropdown from './dropdown';

const ChartTile = styled.div`
  height: 400px;
  width: 50%;
  background-color: ${({theme: {dark}}) => dark ? '#222' : '#fff'};
  border-radius: 10px;
  padding: 1.5rem;
  margin: 1rem;
  display: flex;
  flex-direction: column;
`;

const ChartTileHeader = styled.span`
  font-size: 27px;
  font-weight: bolder;
`;

const ChainHeader: FC<{ currency: string; network: string; blocks?: BitcoinBlockType[] }> = ({ currency, network, blocks }) => {
  const theme = useTheme();
  const priceDetails: {
    data: {
      code: string, 
      name: string, 
      rate: number
    }
  } = useApi(`https://bitpay.com/rates/${currency}/usd`).data;

  const priceDisplay: {
    data: Array<{
      prices: Array<{price: number, time: string}>,
      currencyPair: string,
      currencies: Array<object>,
      priceDisplay: Array<number>,
      percentChange: string,
      priceDisplayPercentChange: string
    }>
  } = useApi(
    `https://bitpay.com/currencies/prices?currencyPairs=["${currency}:USD"]`,
  ).data;

  const price = network === 'mainnet' ? priceDetails?.data?.rate : 0;

  const feeChartRef = useRef<HTMLCanvasElement | null>(null);
  const feeChartInstanceRef = useRef<ChartJS | null>(null);

  const priceChartRef = useRef<HTMLCanvasElement | null>(null);
  const priceChartInstanceRef = useRef<ChartJS | null>(null);
  const priceList = (priceDisplay?.data?.[0]?.priceDisplay || []);

  const feeRanges = ['128 Blocks', '32 Blocks', '16 Blocks', '8 Blocks'];
  const priceRanges = ['24 Hours', '12 Hours', '6 Hours', '3 Hours'];

  const [feeSelectedRange, setFeesSelectedRange] = useState('32 Blocks');
  const [priceSelectedRange, setPriceSelectedRange] = useState('24 Hours');
  
  const [feeChangeSpan, setFeeChangeSpan] = useState(() => { return <span>null</span>; });
  const [priceChangeSpan, setPriceChangeSpan] = useState(() => { return <span>null</span>; });

  useEffect(() => {
    if (feeChartRef.current && blocks) {
      if (feeChartInstanceRef.current) {
        feeChartInstanceRef.current.destroy();
      }
      const num = Number(feeSelectedRange.slice(0, feeSelectedRange.indexOf(' ')));
      const fees = blocks.map((block: BitcoinBlockType) => block.feeData.median).reverse().slice(blocks.length - num);
      const dates = blocks.map((block: BitcoinBlockType) =>
        new Date(block.time).toLocaleString('en-US', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      ).reverse().slice(blocks.length - num);
      const chartData = {
        labels: dates,
        datasets: [
          {
            data: fees,
            fill: false,
            spanGaps: true,
            borderColor: colorCodes[currency],
            borderWidth: 1.5,
            pointRadius: 3
          }
        ]
      };
      const options = {
        scales: {
          y: {
            display: true,
            beginAtZero: true,
            ticks: { maxTicksLimit: 6 }
          },
          x: { display: false }
        },
        plugins: {legend: {display: false}},
        events: [],
        responsive: true,
        maintainAspectRatio: false,
        tension: 0
      };
      feeChartInstanceRef.current = new ChartJS(feeChartRef.current, {
        type: 'line',
        data: chartData,
        options
      });

      const feeChange = fees[fees.length - 1] - fees[0];
      const percentFeeChange = feeChange / fees[0] * 100;


      setFeeChangeSpan(() => {
        return <span>
          <span style={{marginRight: '8px'}}>{feeChange.toFixed(2)} sats/byte ({percentFeeChange.toFixed(2)}%)</span>
          <span style={{color: '#555'}}>Last {feeSelectedRange}</span>
        </span>
      });
    }

    return () => {
      feeChartInstanceRef.current?.destroy();
    };
  }, [blocks, feeSelectedRange, currency]);

  useEffect(() => {
    const hours = Number(priceSelectedRange.slice(0, priceSelectedRange.indexOf(' ')))
    const usedPrices = priceList.slice(priceList.length - hours);
    const priceChartData = {
      labels: usedPrices,
      datasets: [
        {
          data: usedPrices,
          fill: false,
          spanGaps: true,
          borderColor: colorCodes[currency],
          borderWidth: 1.5,
          pointRadius: 3,
        },
      ],
    };
  
    const priceOptions = {
      scales: {
        y: {
          display: true,
          beginAtZero: false,
          ticks: {
            maxTicksLimit: 4,
          }
        },
        x: {display: false}
      },
      plugins: {legend: {display: false}},
      events: [],
      responsive: true,
      maintainAspectRatio: false,
      tension: 0,
    };
    if (priceChartRef.current) {
      if (priceChartInstanceRef.current) {
        priceChartInstanceRef.current.destroy();
      }
      priceChartInstanceRef.current = new ChartJS(priceChartRef.current, {
        type: 'line',
        data: priceChartData,
        options: priceOptions,
      });
    }

    const priceChange = price - usedPrices[0];
    const percentPriceChange = priceChange / usedPrices[0] * 100;

    let color = 'gray';
    if (priceChange > 0) {
      color = 'green';
    } else if (priceChange < 0) {
      color = 'red';
    }

    setPriceChangeSpan(() => {
      return <span>
        <span style={{color, marginRight: '8px'}}>${priceChange.toFixed(2)} ({percentPriceChange.toFixed(2)}%)</span>
        <span style={{color: '#555'}}>Last {priceSelectedRange}</span>
      </span>
    });
    return () => {
      priceChartInstanceRef.current?.destroy();
    };
  }, [priceList, price, priceSelectedRange, currency]);

  return (
    <div>
      <span style={{fontSize: '50px', fontWeight: 'bold'}}>Blocks </span>
        <img
          src={`https://bitpay.com/img/icon/currencies/${currency}.svg`}
          alt={currency}
          style={{height: '25px', marginBottom: '0.25rem'}}
        />
      <div style={{padding: '1rem', backgroundColor: theme.dark ? '#111' : '#f6f7f9', height: 'fit-content', marginBottom: '2rem'}}>
        <div style={{display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'center'}}>
          <ChartTile>
            <span>{getName(currency)} Exchange Rate</span>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <ChartTileHeader>${price.toLocaleString()}</ChartTileHeader>
              <Dropdown options={priceRanges} value={priceSelectedRange} onChange={setPriceSelectedRange} />
            </div>
            {priceChangeSpan}
            <div style={{flex: 1, minHeight: 0}}>
              <canvas ref={priceChartRef} aria-label='price line chart' role='img' />
            </div>
          </ChartTile>
          <ChartTile>
            <span>{getName(currency)} Fee</span>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <ChartTileHeader>{blocks?.at(0)?.feeData.median.toFixed(3)} sats/byte</ChartTileHeader>
              <Dropdown options={feeRanges} value={feeSelectedRange} onChange={setFeesSelectedRange} style={{width: '130px'}} />
            </div>
            {feeChangeSpan}
            <div style={{flex: 1, minHeight: 0}}>
              <canvas ref={feeChartRef} aria-label='fee chart' role='img' />
            </div>
          </ChartTile>
        </div>
      </div>
    </div>
  );
};

export default ChainHeader;
