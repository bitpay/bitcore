import {fetcher} from '../api/api';
import React, {useEffect, useState} from 'react';

import CoinList from '../components/coin-list';
import Info from '../components/info';
import CopyText from '../components/copy-text';
import SupCurrencyLogo from '../components/icons/sup-currency-logo';

import {getApiRoot, getConvertedValue, normalizeParams} from '../utilities/helper-methods';
import {device} from '../utilities/constants';

import styled from 'styled-components';
import {MainTitle, SecondaryTitle} from '../assets/styles/titles';
import {Tile, TileDescription} from '../assets/styles/tile';
import {TransactionBodyCol, TransactionTileBody} from '../assets/styles/transaction';
import {routerFadeIn} from '../utilities/animations';
import {motion} from 'framer-motion';
import {useParams} from 'react-router-dom';
import {useAppDispatch} from '../utilities/hooks';
import {changeCurrency, changeNetwork} from '../store/app.actions';

import {QRCodeSVG} from 'qrcode.react';
import {White} from '../assets/styles/colors';
import nProgress from 'nprogress';

const QRDiv = styled.div`
  background: ${White};
  padding: 1rem;
  width: max-content;
  height: calc(160px + 2rem); // canvas height + padding
  margin: auto;
  @media screen and ${device.tablet} {
    margin-right: 0;
  }
`;

const Address: React.FC = () => {
  const params = useParams<{currency: string; network: string; address: string}>();
  const {address} = params;
  let {currency, network} = params;
  const dispatch = useAppDispatch();
  const [numTransactions, setNumTransactions] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<any>();
  const [tip, setTip] = useState<any>();
  const [txs, setTxs] = useState<any>();

  useEffect(() => {
    if (!currency || !network || !address) return;
    nProgress.start();
    const _normalizeParams = normalizeParams(currency, network);
    currency = _normalizeParams.currency;
    network = _normalizeParams.network;

    const baseUrl = `${getApiRoot(currency)}/${currency}/${network}`;
    dispatch(changeCurrency(currency));
    dispatch(changeNetwork(network));

    Promise.all([
      fetcher(`${baseUrl}/address/${address}/balance`),
      fetcher(`${baseUrl}/block/tip`),
      fetcher(`${baseUrl}/address/${address}/txs?limit=1000`),
    ])
      .then(([_balance, _tip, _txs]) => {
        setBalance(_balance);
        setTip(_tip);
        setTxs(_txs);
      })
      .catch((e: any) => {
        setError(e.message || 'Error getting address.');
      })
      .finally(() => {
        setIsLoading(false);
        nProgress.done();
      });
  }, [currency, network, address]);

  return (
    <>
      {!isLoading ? (
        <>
          {error ? <Info type={'error'} message={error} /> : null}

          {currency && balance && tip && txs && address && network ? (
            <motion.div variants={routerFadeIn} animate='animate' initial='initial'>
              <MainTitle>
                Address
                <SupCurrencyLogo currency={currency} />
              </MainTitle>

              <SecondaryTitle>{address} <CopyText text={address}></CopyText></SecondaryTitle>

              <TransactionTileBody>
                <TransactionBodyCol type='Nine' backgroundColor='transparent' padding='1rem 0'>

                  <Tile withBorderBottom>
                    <TileDescription margin='0 1rem 0 0'>Confirmed Balance</TileDescription>
                    <TileDescription value textAlign='right'>
                      {getConvertedValue(balance.confirmed, currency)} {currency}
                    </TileDescription>
                  </Tile>

                  {balance.unconfirmed > 0 && (
                    <Tile withBorderBottom>
                      <TileDescription margin='0 1rem 0 0'>Unconfirmed Balance</TileDescription>
                      <TileDescription value textAlign='right'>
                        {getConvertedValue(balance.unconfirmed, currency)} {currency}
                      </TileDescription>
                    </Tile>
                  )}

                  <Tile withBorderBottom>
                    <TileDescription margin='0 1rem 0 0'>No. Transactions</TileDescription>
                    <TileDescription value textAlign='right'>
                      {numTransactions || 0}
                    </TileDescription>
                  </Tile>
                </TransactionBodyCol>

                <TransactionBodyCol
                  type='Three'
                  backgroundColor='transparent'
                  textAlign='center'
                  textTAlign='right'
                  padding='1rem 0'>
                  <QRDiv>
                    <QRCodeSVG value={address} size={160} />
                  </QRDiv>
                </TransactionBodyCol>
              </TransactionTileBody>

              <SecondaryTitle>Transactions</SecondaryTitle>

              <CoinList
                txs={txs}
                currency={currency}
                network={network}
                tip={tip}
                transactionsLength={setNumTransactions}
              />
            </motion.div>
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default Address;
