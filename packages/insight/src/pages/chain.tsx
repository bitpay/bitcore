import {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useNavigate, useParams} from 'react-router-dom';
import {fetcher} from 'src/api/api';
import ChainHeader from 'src/components/chain-header';
import {changeCurrency, changeNetwork} from 'src/store/app.actions';
import {getApiRoot, getFormattedDate, normalizeParams, sleep} from 'src/utilities/helper-methods';
import {BlocksType} from 'src/utilities/models';
import nProgress from 'nprogress';
import Info from 'src/components/info';
import { BitPay } from 'src/assets/styles/colors';

const getBlocksUrl = (currency: string, network: string) => {
  return `${getApiRoot(currency)}/${currency}/${network}/block?limit=10`;
};

export const ChainDetails = () => {
  const params = useParams<{currency: string; network: string}>();
  const [blocksList, setBlocksList] = useState<BlocksType[]>();
  const [error, setError] = useState('');
  let {currency, network} = params;

  const navigate = useNavigate();
  const dispatch = useDispatch();

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
  }, [currency, network]);

  const gotoBlocks = async () => {
    await navigate(`/${currency}/mainnet/blocks`);
  };

  const gotoSingleBlockDetailsView = async (hash: string) => {
    await navigate(`/${currency}/${network}/block/${hash}`);
  };

  return (
    <>
      {error ? <Info type={'error'} message={error} /> : null}
    
      <div style={{display: 'flex', width: '100%', gap: '1rem'}}>
        <div style={{width: '50%'}}>
          <div style={{alignSelf: 'stretch'}}>
           {currency && network && <ChainHeader currency={currency} network={network} />}
          </div>
          <div style={{backgroundColor: 'gray', width: 'fit-content', borderRadius: '15px', margin: '1rem', padding: '0.75rem'}}>
            Fee: xxx
          </div>
        </div>
        <div style={{width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <table>
            <tr>
              <th>Height</th>
              <th>Timestamp</th>
              <th>Transactions</th>
              <th>Size</th>
            </tr>
            {
              blocksList?.length ?
              (<tbody>
                {blocksList.map((block: BlocksType, index: number) => {
                  const {height, hash, transactionCount, time, size} = block;
                  return (
                    <tr
                      key={index}
                      onClick={() => gotoSingleBlockDetailsView(hash)}>
                      <td width='25%'>{height}</td>
                      <td width='25%'>{getFormattedDate(time)}</td>
                      <td width='25%'>{transactionCount}</td>
                      <td width='25%'>{size}</td>
                    </tr>
                  );
                })}
              </tbody>
              ): null}
          </table>
          <div style={{backgroundColor: BitPay, borderRadius: '15px', font: 'menu', width: 'fit-content', padding: '0.5rem 1rem'}} onClick={gotoBlocks}>... View all Blocks</div>
        </div>
      </div>
    </>
  );
};
