import {FC, memo, useEffect, useState} from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';

import {TransactionEth} from '../utilities/models';

import InfiniteScrollLoadSpinner from '../components/infinite-scroll-load-spinner';
import Coin from './coin';
import TransactionDetailsEth from './transaction-details-eth';

import {motion} from 'framer-motion';
import styled from 'styled-components';
import {Action} from '../assets/styles/colors';

const SortDiv = styled.div`
  font-size: 16px;
  display: flex;
  margin-bottom: 1rem;

  span {
    margin-right: 0.5rem;
  }
`;

interface SortButtonProps {
  activeTextColor: boolean;
}

const SortButton = styled(motion.button)`
  background: transparent;
  border: none;
`;

const ButtonText = styled.div<SortButtonProps>`
  font-size: 16px;
  color: ${({activeTextColor, theme: {colors}}) => (activeTextColor ? Action : colors.color)};
`;

const LIMIT = 10;
const CHUNK_SIZE = 100;

const ToUiFriendlyEthCoin = (coin: TransactionEth, blockTipHeight: number) => {
  const {to, from, txid, fee, value, blockTime} = coin;
  const blockHeight = parseInt(coin.blockHeight + '', 10);
  const confirmations = blockHeight > 0 ? blockTipHeight - blockHeight + 1 : blockHeight;

  return {
    to,
    from,
    txid,
    fee,
    value,
    blockHeight,
    height: blockHeight,
    blockTime,
    confirmations,
  };
};

const ProcessData = (data: any, blockTipHeight: number) => {
  const txs: any = [];
  for (const tx of data) {
    const {mintHeight, mintTxid, value, spentHeight, spentTxid} = tx;
    if (spentHeight >= -1) {
      txs.push({
        height: spentHeight,
        spentTxid,
        value,
        confirmations: spentHeight > -1 ? blockTipHeight - spentHeight + 1 : spentHeight,
      });
    }
    if (mintHeight >= -1) {
      txs.push({
        height: mintHeight,
        mintTxid,
        value,
        confirmations: mintHeight > -1 ? blockTipHeight - mintHeight + 1 : mintHeight,
      });
    }
  }

  return txs;
};

const GetSortedTxs = (txList: any[], order: string) => {
  return txList.sort((a: any, b: any) => {
    // Sort remaining confirmed transactions by height based on `order`
    const orderSort = order === 'mostRecent' ? b.height - a.height : a.height - b.height;

    // Error transactions: Invalid, Error, Expired in specified order
    const errorOrder = [-3, -4, -5];
    const aErrorIndex = errorOrder.indexOf(a.height);
    const bErrorIndex = errorOrder.indexOf(b.height);

    // Place error transactions at the end
    if (aErrorIndex !== -1 && bErrorIndex !== -1) {
      return aErrorIndex - bErrorIndex;
    }
    if (aErrorIndex !== -1) return 1;
    if (bErrorIndex !== -1) return -1;

    // Place unspent transactions at the end
    if (a.height === -2) return 1;
    if (b.height === -2) return -1;

    // Place unconfirmed transactions at the beginning
    if (a.confirmations === -1) return -1;
    if (b.confirmations === -1) return 1;

    return orderSort;
  });
};

interface CoinListProps {
  txs: any;
  currency: string;
  network: string;
  tip: any;
  transactionsLength: any;
}

const CoinList: FC<CoinListProps> = ({txs, currency, network, tip, transactionsLength}) => {
  const [limit, setLimit] = useState(LIMIT);
  const [chunkSize, setChunkSize] = useState(CHUNK_SIZE);
  const [currentOrder, setCurrentOrder] = useState('mostRecent');

  const {height} = tip;

  const [txsCopy, setTxsCopy] = useState<any>([]);
  const [transactions, setTransactions] = useState<any>([]);
  const [hasMoreTxs, setHasMoreTxs] = useState<boolean>(false);
  const [newVal, setVal] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    let _txs;
    if (currency === 'ETH') {
      _txs = txs.map((tx: any) => ToUiFriendlyEthCoin(tx, height));
    } else {
      _txs = ProcessData(txs, height);
    }
    transactionsLength(_txs.length);
    _txs = GetSortedTxs(_txs, currentOrder);
    setTxsCopy(_txs);
    const _transactions = _txs.slice(0, limit);
    setTransactions(_transactions);
    setHasMoreTxs(_transactions.length < _txs.length);
    setIsLoading(false);
  }, [txs]);

  const sortTransactions = (order: string) => {
    if (currentOrder === order) {
      return;
    }

    setVal(newVal + 1);
    setCurrentOrder(order);
    const sortedTxs = GetSortedTxs(txsCopy, order);
    setTxsCopy(sortedTxs);
    setLimit(LIMIT);
    setChunkSize(CHUNK_SIZE);
    setTransactions(sortedTxs.slice(0, LIMIT));
    setHasMoreTxs(LIMIT < sortedTxs.length);
  };

  const loadMore = () => {
    if (limit < txsCopy.length) {
      const newLimit = limit + chunkSize;
      setLimit(newLimit);
      setChunkSize(chunkSize * 2);
      setTransactions(txsCopy.slice(0, newLimit));
      setHasMoreTxs(newLimit < txs.length);
    }
  };

  const sortBtnAnime = {
    whileHover: {
      cursor: 'pointer',
      scale: 1.02,
    },
  };

  return (
    <>
      {!isLoading ? (
        <>
          <SortDiv>
            <span>Sort by: </span>
            <SortButton
              variants={sortBtnAnime}
              whileHover='whileHover'
              onClick={() => sortTransactions('mostRecent')}>
              <ButtonText activeTextColor={currentOrder === 'mostRecent'}>Most Recent</ButtonText>
            </SortButton>{' '}
            |
            <SortButton
              variants={sortBtnAnime}
              whileHover='whileHover'
              onClick={() => sortTransactions('oldest')}>
              <ButtonText activeTextColor={currentOrder === 'oldest'}>Oldest</ButtonText>
            </SortButton>
          </SortDiv>

          <InfiniteScroll
            dataLength={transactions.length}
            next={loadMore}
            hasMore={hasMoreTxs}
            loader={<InfiniteScrollLoadSpinner />}>
            {transactions.map((tx: any, index: number) => {
              return (
                <div key={index}>
                  {currency === 'ETH' ? (
                    <TransactionDetailsEth transaction={tx} currency={currency} network={network} />
                  ) : (
                    <Coin
                      transaction={tx}
                      currency={currency}
                      network={network}
                      order={currentOrder}
                    />
                  )}
                </div>
              );
            })}
          </InfiniteScroll>
        </>
      ) : null}
    </>
  );
};

export default memo(CoinList);
