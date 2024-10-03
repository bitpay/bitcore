import {getApiRoot, getFormattedDate, normalizeParams} from '../utilities/helper-methods';
import {fetcher} from '../api/api';
import TransactionSummary from '../components/transaction-summary';
import TransactionSummaryEth from '../components/transaction-summary-eth';
import TransactionDetailsEth from '../components/transaction-details-eth';
import TransactionDetails from '../components/transaction-details';
import CopyText from '../components/copy-text';
import Info from '../components/info';
import SupCurrencyLogo from '../components/icons/sup-currency-logo';

import {MainTitle, SecondaryTitle} from '../assets/styles/titles';
import {Tile, TileDescription} from '../assets/styles/tile';
import {DisplayFlex, ConfirmationLabel} from '../assets/styles/global';
import {TransactionBodyCol, TransactionTileBody} from '../assets/styles/transaction';
import {motion} from 'framer-motion';
import {routerFadeIn} from '../utilities/animations';
import {Link, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {useAppDispatch} from '../utilities/hooks';
import React, {useEffect, useState} from 'react';
import {changeCurrency, changeNetwork} from '../store/app.actions';
import nProgress from 'nprogress';
import ConfirmedWav from '../assets/sounds/confirmed.wav';
import NotConfirmedWav from '../assets/sounds/notConfirmed.wav';
import {playSoundEffect} from 'src/utilities/sound';


const TransactionHash: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{currency: string; network: string; tx: string}>();
  const {tx} = params;
  let {currency, network} = params;
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const refvoutParam = searchParams.get('refVout');
  const reftxidParam = searchParams.get('refTxid');
  const [transaction, setTransaction] = useState<any>();
  const dispatch = useAppDispatch();
  const [error, setError] = useState('');
  const [refTxid, setRefTxid] = useState<string | undefined>();
  const [refVout, setRefVout] = useState<number | undefined>();
  let confInterval: NodeJS.Timer | null = null;

  useEffect(() => {
    if (reftxidParam != null && reftxidParam !== '') {
      setRefTxid(reftxidParam);
    } else {
      setRefTxid(undefined);
    }

    if (refvoutParam != null && refvoutParam !== '') {
      setRefVout(Number(refvoutParam));
    } else {
      setRefVout(undefined);
    }
  }, [reftxidParam, refvoutParam]);

  useEffect(() => {
    if (!network || !currency || !tx) return;
    nProgress.start();

    const _normalizeParams = normalizeParams(currency, network);
    network = _normalizeParams.network;
    currency = _normalizeParams.currency;

    const baseUrl = `${getApiRoot(currency)}/${currency}/${network}`;
    dispatch(changeCurrency(currency));
    dispatch(changeNetwork(network));

    Promise.all([
      fetcher(`${baseUrl}/tx/${tx}`),
      fetcher(`${baseUrl}/block/tip`),
      fetcher(`${baseUrl}/tx/${tx}/coins`),
    ])
      .then(([_transaction, _tip, _coins]) => {
        const {height} = _tip;
        const {blockHeight, coinbase} = _transaction;
        const {inputs, outputs} = _coins;

        _transaction.inputs = inputs;
        _transaction.outputs = outputs;
        _transaction.coinbase = currency === 'ETH' ? coinbase : inputs.length === 0;
        _transaction.confirmations = blockHeight > 0 ? height - blockHeight + 1 : blockHeight;

        setTransaction(_transaction);

        if (_transaction.confirmations === -1) { // unconfirmed
          listenForConfs(baseUrl, _transaction);
        }
      })
      .catch((e: any) => {
        setError(e.message || 'Error getting transaction.');
      })
      .finally(() => {
        setIsLoading(false);
        nProgress.done();
      });

    // clear interval on nav to new tx or unmount
    return () => {
      clearInterval(confInterval as NodeJS.Timer);
      confInterval = null;
    };  
  }, [network, currency, tx]);

  const goToTx = (tx: any) => {
    return navigate({
      pathname: `/${currency}/${network}/tx/${tx}`,
      search: '',
    });
  };

  const listenForConfs = (baseUrl: string, transaction: any) => {
    if (confInterval) {
      // already listening for confs
      return;
    }
    confInterval = setInterval(() => {
      Promise.all([
        fetcher(`${baseUrl}/tx/${tx}`),
        fetcher(`${baseUrl}/block/tip`)
      ])
        .then(([_txRefresh, _newTip]) => {
          const {blockHeight} = _txRefresh;
          const {height} = _newTip;
          const confirmations = blockHeight > 0 ? height - blockHeight + 1 : blockHeight;
          if (confirmations !== -1) { // conf status has changed from unconfirmed
            clearInterval(confInterval as NodeJS.Timer);
            confInterval = null;
            transaction.confirmations = confirmations;
            if (confirmations > -1) { // if confirmed
              transaction.blockHash = _txRefresh.blockHash;
              transaction.blockTime = _txRefresh.blockTime;
              playSoundEffect(ConfirmedWav);
            } else if (confirmations < -1) { // if invalid
              transaction.replacedByTxid = _txRefresh.replacedByTxid;
              playSoundEffect(NotConfirmedWav);
            }
            setIsLoading(true);
            nProgress.start();
            setTransaction(transaction);
          }
        })
        .catch(() => {/**/})
        .finally(() => {
          setIsLoading(false);
          nProgress.done();
        })
    }, 10000);
  };


  return (
    <>
      {!isLoading ? (
        <>
          {error ? <Info type={'error'} message={error} /> : null}

          {transaction && currency && network ? (
            <motion.div variants={routerFadeIn} animate='animate' initial='initial'>
              <MainTitle style={{marginBottom: 8}}>
                Transaction
                <SupCurrencyLogo currency={currency} />
              </MainTitle>

              <DisplayFlex>
                <TileDescription margin='0 1rem 0 0' width='auto' noTruncate>
                  Transaction Hash
                </TileDescription>
                <TileDescription value>
                  {transaction.txid}

                  <CopyText text={transaction.txid} />
                </TileDescription>
              </DisplayFlex>

              <SecondaryTitle>Summary</SecondaryTitle>

              {transaction.confirmations === -3 &&
                (transaction.replacedByTxid ? (
                  <Info
                    message={`This transaction was replaced by ${transaction.replacedByTxid}`}
                    type={'error'}
                    onClick={() => goToTx(transaction.replacedByTxid)}
                  />
                ) : (
                  <Info
                    message={`This transaction was replaced by another transaction that ${
                      transaction.chain === 'ETH'
                        ? 'used the same nonce'
                        : 'spent some of it\'s inputs'
                    }.`}
                    type={'error'}
                  />
                ))
              }

              {transaction.confirmations === -5 &&
                <Info
                  message={'This transaction was dropped from the mempool'}
                  type={'error'}
                />
              }

              <TransactionTileBody>
                <TransactionBodyCol
                  type='Twelve'
                  backgroundColor='transparent'
                  padding='0 0 1rem 0'>
                  {currency === 'ETH' ? (
                    <TransactionSummaryEth transaction={transaction} />
                  ) : (
                    <TransactionSummary transaction={transaction} />
                  )}

                  <Tile withBorderBottom>
                    <TileDescription margin='0 1rem 0 0'>Received Time</TileDescription>
                    <TileDescription value textAlign='right'>
                      {getFormattedDate(transaction.blockTime)}
                    </TileDescription>
                  </Tile>

                  <Tile withBorderBottom>
                    <TileDescription margin='0 1rem 0 0'>Included in block</TileDescription>
                    <TileDescription value textAlign='right'>
                      <Link to={`/${currency}/${network}/block/${transaction.blockHash}`}>
                        {transaction.blockHash}
                      </Link>
                      {transaction.confirmations === -3 && (
                        <ConfirmationLabel error padding='0 0 0 .5rem'>
                          Invalid
                        </ConfirmationLabel>
                      )}
                      {transaction.confirmations === -1 && (
                        <ConfirmationLabel warning error padding='0 0 0 .5rem'>
                          Unconfirmed
                        </ConfirmationLabel>
                      )}
                    </TileDescription>
                  </Tile>
                </TransactionBodyCol>
              </TransactionTileBody>

              <SecondaryTitle>Details</SecondaryTitle>

              {currency === 'ETH' ? (
                <TransactionDetailsEth
                  transaction={transaction}
                  currency={currency}
                  network={network}
                />
              ) : (
                <TransactionDetails
                  transaction={transaction}
                  currency={currency}
                  network={network}
                  refVout={refVout}
                  refTxid={refTxid}
                />
              )}
            </motion.div>
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default TransactionHash;
