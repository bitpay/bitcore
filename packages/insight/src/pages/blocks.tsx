import BlockList from 'src/components/block-list';
import React, {useEffect, useState} from 'react';
import ChainHeader from '../components/chain-header';
import {useParams} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {changeCurrency, changeNetwork} from 'src/store/app.actions';
import {getApiRoot, normalizeParams} from 'src/utilities/helper-methods';
import {fetcher} from 'src/api/api';
import nProgress from 'nprogress';
import {BitcoinBlockType} from 'src/utilities/models';
import Info from 'src/components/info';

const Blocks: React.FC = () => {
  let {currency, network} = useParams<{currency: string; network: string}>();
  const dispatch = useDispatch();

  const [blocksList, setBlocksList] = useState<BitcoinBlockType[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    nProgress.start();
    if (!currency || !network)
      return;
    Promise.all([fetcher(`${getApiRoot(currency)}/${currency}/${network}/block?limit=128`)])
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

  if (!currency || !network) return null;

  return (
    <>
      {error ? <Info type={'error'} message={error} /> : null}
      <ChainHeader currency={currency} network={network} blocks={blocksList}/>
      { blocksList && <BlockList currency={currency} network={network} blocks={blocksList} /> }
    </>
  );
}

export default Blocks;