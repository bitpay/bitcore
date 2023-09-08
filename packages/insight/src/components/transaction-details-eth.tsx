import {FC, memo} from 'react';
import {CoinsListEth, TransactionEth} from '../utilities/models';
import {getConvertedValue, getFormattedDate} from '../utilities/helper-methods';
import {
  TransactionBodyCol,
  TransactionTile,
  TransactionTileBody,
  TransactionTileHeader,
  TransactionChip,
  TransactionTileFlex,
  SpanLink,
} from '../assets/styles/transaction';
import {Tile, TileDescription} from '../assets/styles/tile';
import ArrowSvg from '../assets/images/arrow.svg';
import {useNavigate} from 'react-router-dom';

interface TransactionDetailsEthProps {
  transaction: TransactionEth | CoinsListEth;
  currency: string;
  network: string;
}
const TransactionDetailsEth: FC<TransactionDetailsEthProps> = ({
  transaction,
  currency,
  network,
}) => {
  const navigate = useNavigate();
  const {txid, blockTime, blockHeight, coinbase, from, to, fee, confirmations, value} = transaction;

  const goToAddress = (address: any) => {
    return navigate(`/${currency}/${network}/address/${address}`);
  };

  const goToTx = (tx: any) => {
    return navigate({pathname: `/${currency}/${network}/tx/${tx}`});
  };

  return (
    <TransactionTile>
      <TransactionTileHeader>
        <TileDescription value padding='0 .25rem 0 0'>
          <SpanLink onClick={() => goToTx(txid)}>{txid}</SpanLink>
        </TileDescription>

        <TileDescription textAlign='right' value padding='0 0 0 0.25rem'>
          {`${blockHeight > -1 ? 'Mined' : 'Seen'} on: ${getFormattedDate(blockTime)}`}
        </TileDescription>
      </TransactionTileHeader>

      <TransactionTileBody>
        <TransactionBodyCol type='Five' padding='0 1rem'>
          {coinbase && <Tile>No Inputs (Newly Generated Coins)</Tile>}

          {!coinbase && from && (
            <Tile>
              <TileDescription padding='0 1rem 0 0' value>
                <SpanLink onClick={() => goToAddress(from)}>{from}</SpanLink>
              </TileDescription>
            </Tile>
          )}
        </TransactionBodyCol>

        <TransactionBodyCol type='One' textAlign='center' backgroundColor='transparent'>
          <img src={ArrowSvg} width={15} height={15} alt='arrow' />
        </TransactionBodyCol>

        <TransactionBodyCol type='Six' textAlign='right' padding='0 1rem'>
          {to && (
            <Tile>
              <TileDescription padding='0 1rem 0 0' value>
                <SpanLink onClick={() => goToAddress(to)}>{to}</SpanLink>
              </TileDescription>
            </Tile>
          )}
        </TransactionBodyCol>
      </TransactionTileBody>

      <TransactionTileFlex>
        <div>
          {!coinbase && fee > 0 && (
            <TransactionChip>
              FEE: {getConvertedValue(fee, currency)} {currency}
            </TransactionChip>
          )}
        </div>

        <TransactionTileFlex>
          {confirmations === -3 && <TransactionChip error>Invalid</TransactionChip>}

          {confirmations === -1 && <TransactionChip warning>Unconfirmed</TransactionChip>}

          {confirmations === 1 && <TransactionChip primary>1 Confirmation</TransactionChip>}

          {confirmations > 1 && (
            <TransactionChip primary>{confirmations} Confirmations</TransactionChip>
          )}

          <TransactionChip margin='0 0 0 1rem'>
            {getConvertedValue(value, currency)} {currency}
          </TransactionChip>
        </TransactionTileFlex>
      </TransactionTileFlex>
    </TransactionTile>
  );
};

export default memo(TransactionDetailsEth);
