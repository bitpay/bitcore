import React, {useEffect, useState} from 'react';
import {MainTitle} from '../assets/styles/titles';
import {fetcher} from '../api/api';
import InfiniteScroll from 'react-infinite-scroll-component';

import InfiniteScrollLoadSpinner from '../components/infinite-scroll-load-spinner';
import Info from '../components/info';
import SupCurrencyLogo from '../components/icons/sup-currency-logo';

import {getApiRoot, getFormattedDate, normalizeParams, sleep} from '../utilities/helper-methods';
import {BlocksType} from '../utilities/models';
import {size} from '../utilities/constants';

import styled from 'styled-components';
import {motion} from 'framer-motion';
import {routerFadeIn} from '../utilities/animations';
import {useParams, useNavigate} from 'react-router-dom';
import {useAppDispatch} from '../utilities/hooks';
import {changeCurrency, changeNetwork} from '../store/app.actions';
import {LightBlack, NeutralSlate, Slate30} from '../assets/styles/colors';
import nProgress from 'nprogress';

const BlockListTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  overflow-x: hidden;
`;

const BlockListTableHead = styled.tr`
  text-align: center;
  line-height: 45px;
  background-color: ${({theme: {dark}}) => (dark ? '#090909' : NeutralSlate)};
  font-size: 16px;

  @media screen and (max-width: ${size.tablet}) {
    font-size: 14px;
    line-height: 30px;
  }
`;

const BlockListTableRow = styled(motion.tr)`
  text-align: center;
  line-height: 45px;

  &:nth-child(odd) {
    background-color: ${({theme: {dark}}) => (dark ? LightBlack : Slate30)};
  }

  &:nth-child(even) {
    background-color: ${({theme: {dark}}) => (dark ? '#090909' : NeutralSlate)};
  }

  transition: transform 200ms ease, box-shadow 200ms ease;
  font-size: 16px;

  @media screen and (max-width: ${size.tablet}) {
    font-size: 14px;
    line-height: 30px;
  }
`;

const TdLink = styled.td`
  color: ${({theme: {colors}}) => colors.link};
`;

const getBlocksUrl = (currency: string, network: string) => {
  return `${getApiRoot(currency)}/${currency}/${network}/block?limit=200`;
};

const listAnime = {
  whileHover: {
    cursor: 'pointer',
    scale: 1.02,
    transition: {
      bounce: 0,
      duration: 0.05,
      ease: 'linear',
    },
  },
};

const Blocks: React.FC = () => {
  let {currency, network} = useParams<{currency: string; network: string}>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [blocksList, setBlocksList] = useState<BlocksType[]>();
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);

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
        setIsLoading(false);
        nProgress.done();
      });
  }, [currency, network]);

  const fetchMore = async (_blocksList: BlocksType[]) => {
    if (!_blocksList.length || !currency || !network) return;
    const since = _blocksList[_blocksList.length - 1].height;
    try {
      const newData: [BlocksType] = await fetcher(
        `${getBlocksUrl(currency, network)}&since=${since}&paging=height&direction=-1`,
      );
      if (newData?.length) {
        setBlocksList(_blocksList.concat(newData));
      } else {
        setHasMore(false);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again later.');
    }
  };

  const gotoSingleBlockDetailsView = async (hash: string) => {
    await navigate(`/${currency}/${network}/block/${hash}`);
  };

  return (
    <>
      {!isLoading ? (
        <>
          {error ? <Info type={'error'} message={error} /> : null}
          {blocksList?.length ? (
            <motion.div variants={routerFadeIn} animate='animate' initial='initial'>
              <MainTitle>
                Blocks
                {currency && <SupCurrencyLogo currency={currency} />}
              </MainTitle>

              <InfiniteScroll
                next={() => fetchMore(blocksList)}
                hasMore={hasMore}
                loader={<InfiniteScrollLoadSpinner />}
                dataLength={blocksList.length}>
                <BlockListTable id='blockList'>
                  <thead>
                    <BlockListTableHead>
                      <th>Height</th>
                      <th>Timestamp</th>
                      <th>Transactions</th>
                      <th>Size</th>
                    </BlockListTableHead>
                  </thead>
                  <tbody>
                    {blocksList.map((block: BlocksType, index: number) => {
                      const {height, hash, transactionCount, time, size} = block;
                      return (
                        <BlockListTableRow
                          key={index}
                          variants={listAnime}
                          whileHover='whileHover'
                          onClick={() => gotoSingleBlockDetailsView(hash)}>
                          <TdLink width='25%'>{height}</TdLink>
                          <td width='25%'>{getFormattedDate(time)}</td>
                          <td width='25%'>{transactionCount}</td>
                          <td width='25%'>{size}</td>
                        </BlockListTableRow>
                      );
                    })}
                  </tbody>
                </BlockListTable>
              </InfiniteScroll>
            </motion.div>
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default Blocks;
