import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
} from 'chart.js';
import {FC, memo, useEffect, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import styled, {css} from 'styled-components';
import {useApi} from '../api/api';
import LargeThinSpinner from '../assets/images/large-thin-spinner.svg';
import {Error, SlateDark, White} from '../assets/styles/colors';
import {Spinner} from '../assets/styles/spinner';
import {Tile} from '../assets/styles/tile';
import {colorCodes} from '../utilities/constants';
import {buildTime, getApiRoot, getDefaultRefreshInterval} from '../utilities/helper-methods';

// Register necessary Chart.js components
ChartJS.register(CategoryScale, LinearScale, LineController, LineElement, PointElement);

const gutter = '1.5rem';

const LightBackground: {[key in string]: string} = {
  BTC: '#FFF1E0',
  BCH: '#EFFFF6',
  ETH: '#EBECF6',
  LTC: '#FAFAFA',
  DOGE: '#FDF8E6',
};

const DarkBackground: {[key in string]: string} = {
  BTC: '#0C0700',
  BCH: '#020A05',
  ETH: '#06070F',
  LTC: '#0A0A0A',
  DOGE: '#0B0903',
};

interface CurrencyTileDivProps {
  currency: string;
}

const CurrencyTileDiv = styled.div<CurrencyTileDivProps>`
  padding: ${gutter};
  text-align: left;
  border-radius: 8px;
  background: ${({currency, theme: {dark}}) =>
    dark ? DarkBackground[currency] : LightBackground[currency]};
  box-shadow: ${({theme: {dark}}) => (dark ? '0px 5px 20px -5px rgba(0, 0, 0, 0.18)' : 'none')};
  margin-bottom: 2rem;

  &:hover {
    cursor: pointer;
  }
`;

const CurrencyTileHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${gutter};
`;

const CurrencyName = styled.p`
  text-align: right;
  font-size: 16px;
  line-height: 18px;
  margin: 0 0 0.1rem 0;
`;

const CurrencyPrice = styled.p`
  font-size: 14px;
  text-align: right;
  margin: 0;
`;

interface CurrencyTileDescProps {
  value?: any;
}

const CurrencyTileDesc = styled.p<CurrencyTileDescProps>`
  margin: 0;
  font-weight: ${({value}) => (value ? 'normal' : '500')};
  font-size: 14px;
  line-height: 27px;
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
`;

interface PositionDivProps {
  error?: any;
}

const PositionDiv = styled(Spinner)<PositionDivProps>`
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
  ${({error}) =>
    error &&
    css`
      color: ${Error};
      font-size: 16px;
    `}
`;

const ChartContainer = styled.div`
  max-height: 100px;
  margin: 2rem -${gutter};
`;

interface CurrencyTileProps {
  currency: string;
}

const CurrencyTile: FC<CurrencyTileProps> = ({currency}) => {
  const navigate = useNavigate();
  const apiRoot = getApiRoot(currency);
  const refreshInterval = getDefaultRefreshInterval(currency);

  const {data, error} = useApi(`${apiRoot}/${currency}/mainnet/block?limit=1`, {refreshInterval});
  const {data: priceDetails} = useApi(`https://bitpay.com/rates/${currency}/usd`);
  const {data: priceDisplay} = useApi(
    `https://bitpay.com/currencies/prices?currencyPairs=["${currency}:USD"]`,
  );

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);

  const price = priceDetails?.data?.rate;
  const priceList = priceDisplay?.data?.[0]?.priceDisplay || [];

  const chartData = {
    labels: priceList,
    datasets: [
      {
        data: priceList,
        fill: false,
        spanGaps: true,
        borderColor: colorCodes[currency],
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    scales: {
      x: {display: false},
      y: {display: false},
    },
    plugins: {legend: {display: false}},
    events: [], // disable default events
    responsive: true,
    maintainAspectRatio: false,
    tension: 0.5,
  };

  // Create and clean up chart instance
  useEffect(() => {
    if (chartRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      chartInstanceRef.current = new ChartJS(chartRef.current, {
        type: 'line',
        data: chartData,
        options,
      });
    }

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [chartData, options]);

  if (error) {
    return (
      <CurrencyTileDiv currency={currency}>
        <PositionDiv error>Error getting latest block</PositionDiv>
      </CurrencyTileDiv>
    );
  }

  if (!data) {
    return (
      <CurrencyTileDiv currency={currency}>
        <PositionDiv>
          <img src={LargeThinSpinner} height={30} width={30} alt='spinner' />
        </PositionDiv>
      </CurrencyTileDiv>
    );
  }

  const {height, time, transactionCount, size} = data[0];
  const imgSrc = `https://bitpay.com/img/icon/currencies/${currency}.svg`;

  const gotoChain = async () => {
    await navigate(`/${currency}/mainnet/chain`);
  };

  return (
    <CurrencyTileDiv currency={currency} onClick={gotoChain} key={currency}>
      <CurrencyTileHeader>
        <img src={imgSrc} width={35} height={35} alt={`${currency} logo`} />
        <div>
          <CurrencyName>{currency}</CurrencyName>
          {price && <CurrencyPrice>{price} USD</CurrencyPrice>}
        </div>
      </CurrencyTileHeader>

      {priceList.length > 0 && (
        <ChartContainer>
          <canvas ref={chartRef} aria-label='price line chart' role='img' />
        </ChartContainer>
      )}

      <Tile padding='0'>
        <CurrencyTileDesc>Height</CurrencyTileDesc>
        <CurrencyTileDesc value>{height}</CurrencyTileDesc>
      </Tile>

      <Tile padding='0'>
        <CurrencyTileDesc>Mined</CurrencyTileDesc>
        <CurrencyTileDesc value>{buildTime(time)}</CurrencyTileDesc>
      </Tile>

      <Tile padding='0'>
        <CurrencyTileDesc>Transaction</CurrencyTileDesc>
        <CurrencyTileDesc value>{transactionCount}</CurrencyTileDesc>
      </Tile>

      <Tile padding='0'>
        <CurrencyTileDesc>Size</CurrencyTileDesc>
        <CurrencyTileDesc value>{size}</CurrencyTileDesc>
      </Tile>
    </CurrencyTileDiv>
  );
};

export default memo(CurrencyTile);
