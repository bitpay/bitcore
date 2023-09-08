import {useEffect, useState, memo, FC} from 'react';
import {
  getApiRoot,
  getConvertedValue,
  getFee,
  getFormattedDate,
  normalizeParams,
} from '../utilities/helper-methods';
import InfiniteScrollLoadSpinner from './infinite-scroll-load-spinner';
import Info from './info';
import {routerFadeIn} from '../utilities/animations';
import {motion} from 'framer-motion';
import {useNavigate} from 'react-router-dom';
import {fetcher} from '../api/api';
import {MainTitle, SecondaryTitle} from '../assets/styles/titles';
import SupCurrencyLogo from './icons/sup-currency-logo';
import {DisplayFlex} from '../assets/styles/global';
import {Tile, TileDescription, TileLink} from '../assets/styles/tile';
import CopyText from './copy-text';
import {Grid} from '../assets/styles/grid';
import {SharedTile} from './shared';
import InfiniteScroll from 'react-infinite-scroll-component';
import TransactionDetails from './transaction-details';
import nProgress from 'nprogress';

interface BlockDetailsProps {
  currency: string;
  network: string;
  block: string;
}

const populateTxsForBlock = (txData: any, {time, height}: {time: number; height: number}) => {
  const txd = txData.txids.map((txid: any) => {
    const tx: any = {};
    tx.txid = txid;
    tx.inputs = txData.inputs.filter((input: any) => input.spentTxid === txid);
    tx.outputs = txData.outputs.filter((output: any) => output.mintTxid === txid);
    tx.fee = getFee(tx);
    tx.blockHeight = tx.outputs[0].mintHeight;
    tx.blockTime = time;
    tx.value = tx.outputs
      .filter((output: any) => output.mintTxid === txid)
      .reduce((a: any, b: any) => a + b.value, 0);
    tx.inputs.length === 0 ? (tx.coinbase = true) : (tx.coinbase = false);
    tx.confirmations = tx.blockHeight > 0 ? height - tx.blockHeight + 1 : tx.blockHeight;
    return tx;
  });
  return txd;
};

const BlockDetails: FC<BlockDetailsProps> = ({currency, network, block}) => {
  const _normalizeParams = normalizeParams(currency, network);
  currency = _normalizeParams.currency;
  network = _normalizeParams.network;
  const baseUrl = `${getApiRoot(currency)}/${currency}/${network}`;
  const navigate = useNavigate();
  const gotoBlock = (hash: string) => navigate(`/${currency}/${network}/block/${hash}`);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<any>();
  const [transactionList, setTransactionList] = useState<any>();
  const [hasMore, setHasMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [tip, setTip] = useState<any>();
  const [isLoadingMoreData, setIsLoadingMoreData] = useState<boolean>();

  useEffect(() => {
    if (!block) return;
    nProgress.start();
    Promise.all([
      fetcher(`${baseUrl}/block/${block}?limit=200`),
      fetcher(`${baseUrl}/block/${block}/coins/100/${pageNumber}`),
      fetcher(`${baseUrl}/block/tip`),
    ])
      .then(([_summary, _transactionList, _tip]) => {
        setSummary(_summary);
        setTip(_tip);
        if (_transactionList) {
          _transactionList = [_transactionList];
          const formattedData = _transactionList
            .map((data: any) => populateTxsForBlock(data, _tip))
            .flat();

          setTransactionList(formattedData);
          setHasMore(!!_transactionList[_transactionList.length - 1].next);
          setPageNumber(pageNumber + 1);
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
    if (hasMore && !isLoadingMoreData) {
      setIsLoadingMoreData(true);
      fetcher(`${baseUrl}/block/${block}/coins/100/${pageNumber}`)
        .then(_transactionList => {
          _transactionList = [_transactionList];

          const formattedData = _transactionList
            .map((data: any) => populateTxsForBlock(data, tip))
            .flat();

          setTransactionList(transactionList.concat(formattedData));
          setHasMore(!!_transactionList[_transactionList.length - 1].next);
          setPageNumber(pageNumber + 1);
        })
        .catch(e => {
          setError(e.message || 'Something went wrong. Please try again later.');
        })
        .finally(() => setIsLoadingMoreData(false));
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
                <SharedTile title='Merkle Root' description={summary.merkleRoot} />
                <SharedTile
                  title='Difficulty'
                  description={(0x1d00ffff / summary.bits).toString()}
                />
                <SharedTile title='Bits' description={summary.bits} />
                <SharedTile title='Size (bytes)' description={summary.size} />
                <SharedTile title='Version' description={summary.version} />
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
                <SharedTile title='Confirmations' description={summary.confirmations} />

                <SharedTile title='Timestamp' description={getFormattedDate(summary.time) || ''} />
              </Grid>

              <SecondaryTitle>Transactions</SecondaryTitle>

              {transactionList.length ? (
                <InfiniteScroll
                  next={() => loadMore()}
                  hasMore={hasMore}
                  loader={<InfiniteScrollLoadSpinner />}
                  scrollThreshold={0.95}
                  dataLength={transactionList.length}>
                  {transactionList.map((tx: any, index: number) => {
                    return (
                      <div key={index}>
                        <TransactionDetails
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

export default memo(BlockDetails);
