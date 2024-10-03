import {FC, memo} from 'react';
import {TransactionEth} from '../utilities/models';
import {getConvertedValue, getFormattedDate} from '../utilities/helper-methods';
import {SharedTile} from './shared';

interface TransactionSummaryEthProps {
  transaction: TransactionEth;
}
const TransactionSummaryEth: FC<TransactionSummaryEthProps> = ({transaction}) => {
  const {gasLimit, gasPrice, fee, from, to, nonce, blockTime, confirmations} = transaction;
  return (
    <>
      <SharedTile title='From' description={from} />
      <SharedTile title='To' description={to} />
      <SharedTile title='Nonce' description={nonce} />
      <SharedTile title='Gas Limit' description={gasLimit} />
      <SharedTile title='Gas Price' description={`${(gasPrice / 1e9).toFixed(2)} Gwei`} />
      <SharedTile title='Fee' description={`${getConvertedValue(fee, 'ETH').toFixed(8)} ETH`} />
      {confirmations > 0 ? (
        <SharedTile title='Mined Time' description={getFormattedDate(blockTime)} />
      ) : null}
    </>
  );
};

export default memo(TransactionSummaryEth);
