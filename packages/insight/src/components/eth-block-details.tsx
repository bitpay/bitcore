import React, {useEffect, useState, memo} from 'react';
import {
  getApiRoot,
  getConvertedValue,
  getFormattedDate,
  normalizeParams,
} from '../utilities/helper-methods';
import {fetcher} from '../api/api';
import InfiniteScrollLoadSpinner from './infinite-scroll-load-spinner';
import Info from './info';
import {routerFadeIn} from '../utilities/animations';
import SupCurrencyLogo from './icons/sup-currency-logo';
import {MainTitle, SecondaryTitle} from '../assets/styles/titles';
import {motion} from 'framer-motion';
import {Tile, TileDescription, TileLink} from '../assets/styles/tile';
import CopyText from './copy-text';
import {DisplayFlex} from '../assets/styles/global';
import {useNavigate} from 'react-router-dom';
import {Grid} from '../assets/styles/grid';
import InfiniteScroll from 'react-infinite-scroll-component';
import TransactionDetailsEth from './transaction-details-eth';
import {SharedTile} from './shared';
import nProgress from 'nprogress';

const LIMIT = 10;
const CHUNK_SIZE = 100;
interface EthDetailsProps {
  currency: string;
  network: string;
  block: string;
}

const PopulateEthTsxFromBlock = (txData: any, {height}: {height: number}) => {
  const tx: any = {};
  const {txid, fee, blockHeight, blockTime, coinbase, value, to, from, gasLimit, gasPrice} = txData;
  tx.txid = txid;
  tx.fee = fee;
  tx.blockTime = blockTime;
  tx.coinbase = coinbase;
  tx.value = value;
  tx.to = to;
  tx.from = from;
  tx.gasLimit = gasLimit;
  tx.gasPrice = gasPrice;
  tx.confirmations = blockHeight > 0 ? height - blockHeight + 1 : blockHeight;
  return tx;
};

const EthBlockDetails: React.FC<EthDetailsProps> = ({currency, network, block}) => {
  const _normalizeParams = normalizeParams(currency, network);
  currency = _normalizeParams.currency;
  network = _normalizeParams.network;

  const baseUrl = `${getApiRoot(currency)}/${currency}/${network}`;
  const navigate = useNavigate();

  const gotoBlock = (hash: string) => navigate(`/${currency}/${network}/block/${hash}`);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactionList, setTransactionList] = useState<any>();
  const [completeList, setCompleteList] = useState<any>();
  const [summary, setSummary] = useState<any>();

  const [limit, setLimit] = useState(LIMIT);
  const [chunkSize, setChunkSize] = useState(CHUNK_SIZE);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!block) return;
    nProgress.start();
    Promise.all([
      fetcher(`${baseUrl}/tx/?blockHash=${block}`),
      fetcher(`${baseUrl}/block/tip`),
      fetcher(`${baseUrl}/block/${block}`),
    ])
      .then(([_transactionList, _tip, _summary]) => {
        setSummary(_summary);
        if (_transactionList && _tip) {
          const formattedData = _transactionList.map((tx: any) =>
            PopulateEthTsxFromBlock(tx, _tip),
          );
          setHasMore(!!formattedData.length);
          setTransactionList(formattedData.slice(0, limit));
          setCompleteList(formattedData);
        }
      })
      .catch((e: any) => {
        setError(e.message || 'Something went wrong. Please try again later.');
      })
      .finally(() => {
        setIsLoading(false);
        nProgress.done();
      });
  }, [block]);

  const loadMore = () => {
    if (limit < completeList.length) {
      const newLimit = limit + chunkSize;
      setLimit(newLimit);
      setChunkSize(chunkSize * 2);
      setTransactionList(completeList.slice(0, newLimit));
      setHasMore(newLimit < completeList.length);
    }
  };

  return (
    <>
      {!isLoading ? (
        <>
          {error ? <Info type={'error'} message={error} /> : null}
          {summary ? (
            <motion.div variants={routerFadeIn} animate='animate' initial='initial'>
              <MainTitle style={{marginBottom: 8}}>
                Block #{summary.height}
                <SupCurrencyLogo currency={currency} />
              </MainTitle>

              <DisplayFlex>
                <TileDescription margin='0 1rem 0 0' width='auto' noTruncate>
                  Block Hash
                </TileDescription>
                <TileDescription value>
                  {summary.hash}

                  <CopyText text={summary.hash} />
                </TileDescription>
              </DisplayFlex>

              <SecondaryTitle>Summary</SecondaryTitle>

              <Grid margin='0 0 3rem 0'>
                <SharedTile title='Total Difficulty' description={summary.totalDifficulty} />
                <SharedTile title='Difficulty' description={summary.difficulty} />
                <SharedTile title='Gas Limit' description={summary.gasLimit} />
                <SharedTile title='Size (bytes)' description={summary.size} />

                <SharedTile title='Gas Used' description={summary.gasUsed} />
                <SharedTile title='Nonce' description={summary.nonce} />
                <SharedTile title='Number of Transactions' description={summary.transactionCount} />

                <Tile withBorderBottom>
                  <TileDescription margin='0 1rem 0 0'>Previous Block</TileDescription>
                  <TileLink value textAlign='right' disabled={!summary.previousBlockHash}>
                    <span
                      onClick={() =>
                        summary.previousBlockHash ? gotoBlock(summary.previousBlockHash) : null
                      }>
                      {summary.height - 1}
                    </span>
                  </TileLink>
                </Tile>

                <SharedTile title='Height' description={summary.height} />

                <Tile withBorderBottom>
                  <TileDescription margin='0 1rem 0 0'>Next Block</TileDescription>
                  <TileLink value textAlign='right' disabled={!summary.nextBlockHash}>
                    <span
                      onClick={() =>
                        summary.nextBlockHash ? gotoBlock(summary.nextBlockHash) : null
                      }>
                      {summary.height + 1}
                    </span>
                  </TileLink>
                </Tile>

                <SharedTile
                  title='Block Reward'
                  description={`${getConvertedValue(summary.reward, currency).toFixed(
                    3,
                  )} ${currency}`}
                />
                <SharedTile title='Confirmation' description={summary.confirmations} />

                <SharedTile title='Timestamp' description={getFormattedDate(summary.time) || ''} />
              </Grid>

              <SecondaryTitle>Transactions</SecondaryTitle>

              {transactionList.length ? (
                <InfiniteScroll
                  dataLength={transactionList.length}
                  next={loadMore}
                  hasMore={hasMore}
                  loader={<InfiniteScrollLoadSpinner />}>
                  {transactionList.map((tx: any, index: number) => {
                    return (
                      <div key={index}>
                        <TransactionDetailsEth
                          transaction={tx}
                          currency={currency}
                          network={network}
                        />
                      </div>
                    );
                  })}
                </InfiniteScroll>
              ) : (
                <Info
                  type={'warning'}
                  message={'There are no transactions involving this block.'}
                />
              )}
            </motion.div>
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default memo(EthBlockDetails);
