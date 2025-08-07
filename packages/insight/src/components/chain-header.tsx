import {FC, useEffect, useRef} from 'react';
import {useApi} from 'src/api/api';
import {Chart as ChartJS} from 'chart.js';
import {colorCodes} from 'src/utilities/constants';

const ChainHeader: FC<{currency: string; network: string}> = ({currency, network}) => {
  const {data: priceDetails} = useApi(`https://bitpay.com/rates/${currency}/usd`);
  const {data: priceDisplay} = useApi(
    `https://bitpay.com/currencies/prices?currencyPairs=["${currency}:USD"]`,
  );

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);

  const price = network === 'mainnet' ? priceDetails?.data?.rate : 0;
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

  return (
    <div style={{borderBottom: '1px solid', padding: '0 5px', height: 'fit-content'}}>
      <div style={{display: 'flex'}}>
        <img
          src={`https://bitpay.com/img/icon/currencies/${currency}.svg`}
          alt={currency}
          style={{height: '100px'}}
        />
        {priceList.length > 0 && (
          <div style={{height: '100px', width: '100%'}}>
            <canvas ref={chartRef} aria-label='price line chart' role='img' />
          </div>
        )}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-around'}}>
        <span style={{margin: '0 10px'}}>{price} USD </span>
      </div>
    </div>
  );
};

export default ChainHeader;
