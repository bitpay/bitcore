import {CoinsList} from '../utilities/models';
import {FC, useEffect, useState, memo} from 'react';
import {getApiRoot, getConvertedValue, getFormattedDate} from '../utilities/helper-methods';
import {fetcher} from '../api/api';
import {
  TransactionTile,
  TransactionTileBody,
  TransactionChip,
  TransactionTileFlex,
  SpanLink,
  TransactionBodyCol,
} from '../assets/styles/transaction';
import {Tile, TileDescription, TileLink} from '../assets/styles/tile';
import {useNavigate} from 'react-router-dom';

interface CoinProps {
  transaction: CoinsList;
  currency: string;
  network: any;
  order: string;
}
const Coin: FC<CoinProps> = ({transaction, currency, network, order}) => {
  const navigate = useNavigate();
  const [showTimer, setShowTimer] = useState(false);
  const [time, setTime] = useState(null);
  const {mintTxid, height, confirmations, value, spentTxid} = transaction;

  const gotToTx = (txid: string | undefined) => {
    return navigate({pathname: `/${currency}/${network}/tx/${txid}`});
  };

  const getTxData = async (txid: string | undefined) => {
    const apiRoot = getApiRoot(currency as string);
    const endpoint = `${apiRoot}/${currency}/${network}/tx/${txid}`;
    try {
      const {blockTime} = await fetcher(endpoint);
      setTime(blockTime);
      setShowTimer(true);
    } catch (e) {
      console.log(e);
    }
  };

  // To reset Timer when list order changes
  useEffect(() => {
    setShowTimer(false);
  }, [order]);

  return (
    <TransactionTile>
      {mintTxid && (
        <>
          <TransactionTileBody>
            {height >= -1 && (
              <TransactionBodyCol type='Six' padding='0 1rem'>
                <Tile>
                  <TileDescription padding='0 1rem 0 0' value>
                    <SpanLink onClick={() => gotToTx(mintTxid)}>{mintTxid}</SpanLink>
                  </TileDescription>
                </Tile>
              </TransactionBodyCol>
            )}
            <TransactionBodyCol type='Six' backgroundColor='transparent' padding='0 1rem'>
              <TransactionTileFlex justifyContent='flex-end'>
                {height === -3 && <TransactionChip error>Invalid</TransactionChip>}

                {confirmations === -1 && <TransactionChip warning>Unconfirmed</TransactionChip>}

                {confirmations === 1 && <TransactionChip primary>1 Confirmation</TransactionChip>}

                {confirmations > 1 && (
                  <TransactionChip primary>{confirmations} Confirmations</TransactionChip>
                )}

                <TransactionChip margin='0 0 0 1rem'>
                  {getConvertedValue(value, currency)} {currency}
                </TransactionChip>
              </TransactionTileFlex>
            </TransactionBodyCol>
          </TransactionTileBody>

          <TransactionTileFlex>
            {showTimer ? (
              <TileDescription value width='auto'>
                {' '}
                {confirmations > 0 ? 'Mined' : 'Seen'} on {getFormattedDate(time)}{' '}
              </TileDescription>
            ) : (
              <TileLink value width='auto' onClick={() => getTxData(mintTxid)}>
                Tx Details
              </TileLink>
            )}
          </TransactionTileFlex>
        </>
      )}

      {spentTxid && (
        <>
          <TransactionTileBody>
            {height >= -1 && (
              <TransactionBodyCol type='Six' padding='0 1rem'>
                <Tile>
                  <TileDescription padding='0 1rem 0 0' value>
                    <SpanLink onClick={() => gotToTx(spentTxid)}>{spentTxid}</SpanLink>
                  </TileDescription>
                </Tile>
              </TransactionBodyCol>
            )}

            <TransactionBodyCol type='Six' backgroundColor='transparent' padding='0 1rem'>
              <TransactionTileFlex justifyContent='flex-end'>
                {height === -2 && <TransactionChip>Unspent</TransactionChip>}

                {height === -3 && <TransactionChip error>Invalid</TransactionChip>}

                {height === -4 && <TransactionChip error>Error</TransactionChip>}

                {confirmations === -1 && <TransactionChip warning>Unconfirmed</TransactionChip>}

                {confirmations === 1 && <TransactionChip primary>1 Confirmation</TransactionChip>}

                {confirmations > 1 && (
                  <TransactionChip primary>{confirmations} Confirmations</TransactionChip>
                )}

                <TransactionChip error margin='0 0 0 1rem'>
                  - {getConvertedValue(value, currency)} {currency}
                </TransactionChip>
              </TransactionTileFlex>
            </TransactionBodyCol>
          </TransactionTileBody>

          <TransactionTileFlex>
            {showTimer ? (
              <TileDescription value width='auto'>
                {' '}
                {confirmations > 0 ? 'Mined' : 'Seen'} on {getFormattedDate(time)}{' '}
              </TileDescription>
            ) : (
              <TileLink value width='auto' onClick={() => getTxData(spentTxid)}>
                Tx Details
              </TileLink>
            )}
          </TransactionTileFlex>
        </>
      )}
    </TransactionTile>
  );
};

export default memo(Coin);
