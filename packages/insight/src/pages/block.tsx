import Info from '../components/info';
import {useParams} from 'react-router-dom';
import EthBlockDetails from '../components/eth-block-details';
import BlockDetails from '../components/block-details';
import React, {useEffect} from 'react';
import {normalizeParams} from '../utilities/helper-methods';
import {changeCurrency, changeNetwork} from '../store/app.actions';
import {useAppDispatch} from '../utilities/hooks';

const Block: React.FC = () => {
  const params = useParams<{currency: string; network: string; block: string}>();
  const {block} = params;
  const dispatch = useAppDispatch();
  let {currency, network} = params;

  useEffect(() => {
    if (!currency || !network || !block) {
      return;
    }
    const _normalizeParams = normalizeParams(currency, network);
    currency = _normalizeParams.currency;
    network = _normalizeParams.network;
    dispatch(changeCurrency(currency));
    dispatch(changeNetwork(network));
  }, [currency, network, block]);

  if (currency && network && block) {
    if (currency.toUpperCase() === 'ETH') {
      return <EthBlockDetails currency={currency} network={network} block={block} />;
    } else {
      return <BlockDetails currency={currency} network={network} block={block} />;
    }
  } else {
    return <Info type={'error'} message={'Something went wrong. Please try again later.'} />;
  }
};

export default Block;
