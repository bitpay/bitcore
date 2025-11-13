import BlockList from 'src/components/block-list';
import React, {createContext, useContext, useEffect, useState} from 'react';
import ChainHeader from '../components/chain-header';
import {useParams} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {changeCurrency, changeNetwork} from 'src/store/app.actions';
import {getApiRoot, normalizeParams} from 'src/utilities/helper-methods';
import {fetcher} from 'src/api/api';
import nProgress from 'nprogress';
import {BitcoinBlockType} from 'src/utilities/models';
import Info from 'src/components/info';

type BlocksContextType = {
  blocks: BitcoinBlockType[] | undefined;
  setBlocks: React.Dispatch<React.SetStateAction<BitcoinBlockType[] | undefined>>;
};

const BlocksContext = createContext<BlocksContextType | undefined>(undefined);

export const BlocksProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [blocks, setBlocks] = useState<BitcoinBlockType[]>();
  return (
    <BlocksContext.Provider value={{ blocks, setBlocks }}>
      {children}
    </BlocksContext.Provider>
  );
};

export const useBlocks = () => {
  const ctx = useContext(BlocksContext);
  if (!ctx) throw new Error('useBlocks must be used within a BlocksProvider');
  return ctx;
};

const Blocks: React.FC = () => {
  let {currency, network} = useParams<{currency: string; network: string}>();
  const dispatch = useDispatch();

  const { blocks, setBlocks } = useBlocks();
  const [error, setError] = useState('');

  useEffect(() => {
    nProgress.start();
    if (!currency || !network)
      return;
    Promise.all([fetcher(`${getApiRoot(currency)}/${currency}/${network}/block?limit=200`)])
      .then(([data]) => {
        setBlocks(data);
      })
      .catch((e: any) => {
        setError(e.message || 'Something went wrong. Please try again later.');
      })
      .finally(() => {
        nProgress.done();
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
      <ChainHeader currency={currency} network={network} />
      { blocks && <BlockList currency={currency} network={network} /> }
    </>
  );
}

export default Blocks;