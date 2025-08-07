import React, {useEffect, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useNavigate, useParams} from 'react-router-dom';
import {fetcher} from 'src/api/api';
import ChainHeader from 'src/components/chain-header';
import {changeCurrency, changeNetwork} from 'src/store/app.actions';
import {getApiRoot, normalizeParams, sleep} from 'src/utilities/helper-methods';
import {BlocksType} from 'src/utilities/models';
import nProgress from 'nprogress';
import Info from 'src/components/info';
import {BitPay, Slate} from 'src/assets/styles/colors';
import {colorCodes} from 'src/utilities/constants';
import {Chart as ChartJS} from 'chart.js';

const getBlocksUrl = (currency: string, network: string) => {
  return `${getApiRoot(currency)}/${currency}/${network}/block?limit=6`;
};

export const ChainDetails = () => {
  const params = useParams<{currency: string; network: string}>();
  const [blocksList, setBlocksList] = useState<BlocksType[]>();
  const [error, setError] = useState('');
  let {currency, network} = params;

  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const feeRef = useRef<HTMLCanvasElement | null>(null);
  const feeInstanceRef = useRef<ChartJS | null>(null);

  const fees =  [0, 1, 7, 3, 2, 1, 5];
  const feeData = {
    labels: fees,
    datasets: [
      {
        data: fees,
        borderColor: Slate,
        borderWidth: 3,
        pointRadius: 0,
      }
    ]
  };

  const options = {
    scales: {
      x: {display: false},
      y: {display: true},
    },
    plugins: {legend: {display: false}},
    events: [], // disable default events
    responsive: true,
    maintainAspectRatio: false,
    tension: 0.1,
  };

  useEffect(() => {
    if (!currency || !network) return;
    nProgress.start();
    const _normalizeParams = normalizeParams(currency, network);

    currency = _normalizeParams.currency;
    network = _normalizeParams.network;

    dispatch(changeCurrency(currency));
    dispatch(changeNetwork(network));

    Promise.all([fetcher(getBlocksUrl(currency, network)), sleep(500)])
      .then(([data]) => {
        setBlocksList(data);
      })
      .catch((e: any) => {
        setError(e.message || 'Something went wrong. Please try again later.');
      })
      .finally(() => {
        nProgress.done();
      });
    
    if (feeRef.current) {
      if (feeInstanceRef.current) {
        feeInstanceRef.current.destroy();
      }

      feeInstanceRef.current = new ChartJS(feeRef.current, {
        type: 'line',
        data: feeData,
        options,
      });
    }
  }, [currency, network]);

  const gotoBlocks = async () => {
    await navigate(`/${currency}/mainnet/blocks`);
  };

  const gotoSingleBlockDetailsView = async (hash: string) => {
    await navigate(`/${currency}/${network}/block/${hash}`);
  };

  if (!currency || !network)
    return null;

  return (
    <>
      {error ? <Info type={'error'} message={error} /> : null}
    
      <div style={{display: 'flex', flex: 1, width: '100%', gap: '1rem'}}>
        <div style={{width: '100%'}}>
          <div style={{alignSelf: 'stretch'}}>
           <ChainHeader currency={currency} network={network} />
          </div>
          <div style={{backgroundColor: colorCodes[currency], width: 'fit-content', borderRadius: '15px', margin: '1rem 0.5rem', padding: '0.75rem'}}>
            <b>Fee: xxx</b>
          </div>
          <div style={{height: '100px', width: '100%'}}>
            <canvas ref={feeRef} aria-label='price line chart' role='img' />
          </div>
        </div>
        <div style={{width: 'fit-content', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{backgroundColor: BitPay, borderRadius: '15px', font: 'menu', width: 'fit-content', padding: '0.5rem 1rem', margin: '0.5rem'}} onClick={gotoBlocks}>View all Blocks</div>
          {
            blocksList?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {blocksList.map((block: BlocksType, index: number) => {
              const { height, hash, transactionCount, time, size } = block;
              const milisecondsWhenMined = Date.now() - new Date(time).getTime();
              const minutesWhenMined = Math.floor(milisecondsWhenMined / 60000);
              return (
                <React.Fragment key={index}>
                  <div
                    onClick={() => gotoSingleBlockDetailsView(hash)}
                    style={{
                      border: '4px solid #333',
                      borderRadius: '10px',
                      padding: '1rem',
                      width: '100%',
                      maxWidth: '400px',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
                    }}
                  >
                    <b>
                    <div>{height}</div>
                    <div>{transactionCount} transactions</div>
                    <div>{size} bytes</div>
                    <div style={{whiteSpace: 'nowrap'}}>mined {minutesWhenMined} minutes ago</div>
                    </b>
                  </div>

                  {index !== blocksList.length - 1 && (
                    <div style={{ fontSize: '1.5rem', color: '#666' }}>|</div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          ): null}
        </div>
      </div>
    </>
  );
};
