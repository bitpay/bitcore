import BlockSample from 'src/components/block-sample';
import React, {useEffect, useState} from 'react';
import ChainHeader from '../components/chain-header';
import {useNavigate, useParams} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {changeCurrency, changeNetwork} from 'src/store/app.actions';
import {getApiRoot, normalizeParams} from 'src/utilities/helper-methods';
import styled, { useTheme } from 'styled-components';
import {colorCodes, size} from 'src/utilities/constants';
import {fetcher} from 'src/api/api';
import BlockGroupDarkSvg from '../assets/images/block-group-dark.svg'
import BlockGroupLightSvg from '../assets/images/block-group-light.svg'
import nProgress from 'nprogress';

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

const BlocksLinkChip = styled.div`
  display: flex;
  border-radius: 10px;
  font: menu;
  width: 100%;
  gap: 0.5rem;
  padding: 0.2rem 0;
  margin: 0.25rem 0;
  justify-content: center;
`

const Chain: React.FC = () => {
  let {currency, network} = useParams<{currency: string; network: string}>();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [tipFee, setTipFee] = useState<number>();
  const theme = useTheme();
  
  useEffect(() => {
    if (!currency || !network) return;
    nProgress.start();
    const _normalizeParams = normalizeParams(currency, network);
    currency = _normalizeParams.currency;
    network = _normalizeParams.network;

    dispatch(changeCurrency(currency));
    dispatch(changeNetwork(network));

    Promise.all([
      fetcher(`${getApiRoot(currency)}/${currency}/${network}/block/tip/fee`)
    ])
      .then(([fee]) => {
        setTipFee(fee.mean.toFixed(5));
        nProgress.done();
      });
  }, [currency, network]);

  const gotoBlocks = async () => {
    await navigate(`/${currency}/${network}/blocks`);
  };


  const BlockGroupIcon: React.FC = () => {
    return (
      <img src={theme.dark ? BlockGroupLightSvg : BlockGroupDarkSvg}
        style={{height:'1.5rem'}}/>
    );
  }

  if (!currency || !network) return null;

  return (
    <>
      <HeaderDataContainer>
        <div style={{width: '100%', minWidth: 0}}>
          <ChainHeader currency={currency} network={network}/>
          <b>Tip Fee {tipFee} sats/byte</b>
        </div>
        <div style={{width: 'fit-content', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <BlocksLinkChip style={{backgroundColor: colorCodes[currency]}} onClick={gotoBlocks}>
            <BlockGroupIcon />
            <b>View all Blocks</b>
            <BlockGroupIcon />
          </BlocksLinkChip>
          <BlockSample currency={currency} network={network}/>
        </div>
      </HeaderDataContainer>
    </>
  );
}

export default Chain;