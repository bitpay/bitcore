import {FC, useEffect, useRef, useState} from 'react';
import {fetcher} from 'src/api/api';
import {Chart as ChartJS} from 'chart.js';
import {colorCodes, size} from 'src/utilities/constants';
import {BitcoinBlockType} from 'src/utilities/models';
import styled from 'styled-components';
import {getName} from 'src/utilities/helper-methods';
import Dropdown from './dropdown';
import {useBlocks} from 'src/contexts';
import {FeeChangeSpan, PriceChangeSpan} from './change-span';
import Info from './info';

const ChartTile = styled.div<{ fullWidth?: boolean }>`
  height: 400px;
  width: ${({fullWidth}) => fullWidth ? '100%' : '50%'};
  background-color: ${({theme: {dark}}) => dark ? '#222' : '#fff'};
  border-radius: 10px;
  padding: 1.5rem;
  margin: 1rem;
  display: flex;
  flex-direction: column;

  @media screen and (max-width: ${size.mobileL}) {
    width: 100%;
    margin: 0.5rem;
  }
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;
  padding: 1rem;
  background-color: ${({theme: {dark}}) => dark ? '#111' : '#f6f7f9'};
  height: fit-content;
  margin-bottom: 2rem;

  @media screen and (max-width: ${size.mobileL}) {
    flex-direction: column;
    padding: 0.25rem 0.6rem;
  }
`;

const ChartTileHeader = styled.span`
  font-size: 27px;
  font-weight: bolder;
`;

interface PriceDetails {
  data: {
    code: string, 
    name: string, 
    rate: number
  }
}

interface PriceDisplay {
  data: Array<{
    prices: Array<{price: number, time: string}>,
    currencyPair: string,
    currencies: Array<object>,
    priceDisplay: Array<number>,
    percentChange: string,
    priceDisplayPercentChange: string
  }>
}

const ChainHeader: FC<{ currency: string; network: string }> = ({ currency, network }) => {
  const { blocks } = useBlocks();
  const [price, setPrice] = useState<number>(0);
  const [priceList, setPriceList] = useState<PriceDisplay['data'][0]['priceDisplay']>([0]);
  const [error, setError] = useState('');

  const feeChartRef = useRef<HTMLCanvasElement | null>(null);
  const feeChartInstanceRef = useRef<ChartJS | null>(null);

  const priceChartRef = useRef<HTMLCanvasElement | null>(null);
  const priceChartInstanceRef = useRef<ChartJS | null>(null);

  const feeRanges = ['128 Blocks', '32 Blocks', '16 Blocks', '8 Blocks'];
  const priceRanges = ['24 Hours', '12 Hours', '6 Hours', '3 Hours'];

  const [feeSelectedRange, setFeesSelectedRange] = useState('32 Blocks');
  const [priceSelectedRange, setPriceSelectedRange] = useState('24 Hours');
  
  const hasFees = blocks?.at(0)?.feeData !== undefined;

  useEffect(() => {
    if (feeChartRef.current && blocks && hasFees) {
      if (feeChartInstanceRef.current) {
        feeChartInstanceRef.current.destroy();
      }
      const numBlocks = Number(feeSelectedRange.slice(0, feeSelectedRange.indexOf(' ')));
      const fees = blocks.map((block: BitcoinBlockType) => block.feeData?.median as number).reverse().slice(blocks.length - numBlocks);
      const dates = blocks.map((block: BitcoinBlockType) =>
        new Date(block.time).toLocaleString('en-US', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      ).reverse().slice(blocks.length - numBlocks);
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
    }

    return () => {
      feeChartInstanceRef.current?.destroy();
    };
  }, [blocks, feeSelectedRange, currency]);

  useEffect(() => {
    if (network !== 'mainnet') {
      setPrice(0);
      setPriceList([0]);
    } else {
      fetcher(`https://bitpay.com/rates/${currency}/usd`)
        .then(({data}: PriceDetails) => {
          setPrice(data.rate);
        })
        .catch(() => {
          setError('Error fetching price. Please try again later.');
        });

      fetcher(`https://bitpay.com/currencies/prices?currencyPairs=["${currency}:USD"]`)
        .then((priceDisplay: PriceDisplay) => {
          setPriceList(priceDisplay.data[0].priceDisplay);
        })
        .catch(() => {
          setError('Error fetching price graph data. Please try again later.');
        });
    }
  }, [currency]);

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

    return () => {
      priceChartInstanceRef.current?.destroy();
    };
  }, [priceList, priceSelectedRange, currency]);

  return (
    <div>
      <span style={{fontSize: '50px', fontWeight: 'bold'}}>Blocks </span>
        <img
          src={`https://bitpay.com/img/icon/currencies/${currency}.svg`}
          alt={currency}
          style={{height: '25px', marginBottom: '0.25rem'}}
        />
      <ChartContainer>          
        <ChartTile fullWidth={!hasFees}>
          { error ?  <Info type={'error'} message={error} />: 
            <>
              <span>{getName(currency)} Exchange Rate</span>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <ChartTileHeader>${price.toLocaleString()}</ChartTileHeader>
                <Dropdown options={priceRanges} value={priceSelectedRange} onChange={setPriceSelectedRange} />
              </div>
              <PriceChangeSpan prices={priceList} lastPrice={price} range={priceSelectedRange} />
              <div style={{flex: 1, minHeight: 0}}>
                <canvas ref={priceChartRef} aria-label='price line chart' role='img' />
              </div>
            </>
          }
        </ChartTile>
        { hasFees &&
          <ChartTile>
            <span>{getName(currency)} Fee</span>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <ChartTileHeader>{blocks?.at(0)?.feeData?.median.toLocaleString()} sats/byte</ChartTileHeader>
              <Dropdown options={feeRanges} value={feeSelectedRange} onChange={setFeesSelectedRange} style={{width: '130px'}} />
            </div>
            <FeeChangeSpan range={feeSelectedRange} />
            <div style={{flex: 1, minHeight: 0}}>
              <canvas ref={feeChartRef} aria-label='fee chart' role='img' />
            </div>
          </ChartTile>
        }
      </ChartContainer>
    </div>
  );
};

export default ChainHeader;
