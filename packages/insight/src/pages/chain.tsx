import BlockSample from 'src/components/block-sample';
import React, {useEffect, useRef, useState} from 'react';
import ChainHeader from '../components/chain-header';
import {useParams} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {changeCurrency, changeNetwork} from 'src/store/app.actions';
import {getApiRoot, normalizeParams} from 'src/utilities/helper-methods';
import styled from 'styled-components';
import {size} from 'src/utilities/constants';
import {fetcher} from 'src/api/api';
import nProgress from 'nprogress';
import {Chart as ChartJS} from 'chart.js';
import {BitcoinBlockType} from 'src/utilities/models';
import Info from 'src/components/info';

const HeaderDataContainer = styled.div`
  width: 100%;
  gap: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center; /* center on mobile by default */

  @media screen and (min-width: ${size.mobileL}) {
    flex-direction: row;
    align-items: flex-start;
  }
`;

const Chain: React.FC = () => {
  let {currency, network} = useParams<{currency: string; network: string}>();
  const dispatch = useDispatch();

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);
  const [blocksList, setBlocksList] = useState<BitcoinBlockType[]>();
  const [error, setError] = useState('');

  const chartData: {
    labels: string[], 
    datasets: {
      data: number[],
      [key: string]: any
    }[]
   } = {
    labels: [],
    datasets: [
      {
        data: [0],
        fill: false,
        spanGaps: true,
        borderColor: '#555',
        borderWidth: 3,
        pointRadius: 0
      }
    ]
  };

  const options = {
    scales: {
      y: {
        display: true,
        beginAtZero: false,
        title: {
          display: true,
          text: 'sats/Byte',
          font: { size: 14 }
        },
        ticks: {
          maxTicksLimit: 6
        }
      },
      x: {
        display: true,
        ticks: {
          maxTicksLimit: 10
        }
      },
    },
    plugins: {legend: {display: false}},
    events: [],
    responsive: true,
    maintainAspectRatio: false,
    tension: 0.1
  };

  useEffect(() => {
    nProgress.start();
    if (!currency || !network)
      return;
    Promise.all([fetcher(`${getApiRoot(currency)}/${currency}/${network}/block?limit=50 `)])
      .then(([data]) => {
        setBlocksList(data);
      })
      .finally(() => {
        nProgress.done();
      })
      .catch((e: any) => {
        setError(e.message || 'Something went wrong. Please try again later.');
      });
  }, []);

  useEffect(() => {
    if (!currency || !network) return;
    const _normalizeParams = normalizeParams(currency, network);
    currency = _normalizeParams.currency;
    network = _normalizeParams.network;

    dispatch(changeCurrency(currency));
    dispatch(changeNetwork(network));
  }, [currency, network]);

  useEffect(() => {
    if (chartRef.current) {
      if (!blocksList)
        return;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      const fees = blocksList.map((block: BitcoinBlockType) => block.feeData.median).reverse();
      const dates = blocksList.map((block: BitcoinBlockType) =>
        new Date(block.time).toLocaleString('en-US', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      ).reverse();      
      chartData.labels = dates;
      chartData.datasets[0].data = fees;
      chartInstanceRef.current = new ChartJS(chartRef.current, {
        type: 'line',
        data: chartData,
        options
      });
    }

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [chartData, options, blocksList]);

  if (!currency || !network) return null;


  return (
    <>
      {error ? <Info type={'error'} message={error} /> : null}
      <HeaderDataContainer>
        <div style={{width: '100%', minWidth: 0}}>
          <ChainHeader currency={currency} network={network}/>
          <div style={{height: '200px', width: '100%', minWidth: 0}}>
            <canvas ref={chartRef} aria-label='price line chart' role='img' />
          </div>
          { blocksList && <BlockSample currency={currency} blocksList={blocksList} /> }
        </div>
        <div style={{width: 'fit-content', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        </div>
      </HeaderDataContainer>
    </>
  );
}

export default Chain;