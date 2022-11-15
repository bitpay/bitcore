import {TransactionEth} from '../utilities/models';
import {getConvertedValue, getFormattedDate} from '../utilities/helper-methods';
import {SharedTile} from './shared';

const TransactionSummaryEth = ({transaction}: {transaction: TransactionEth}) => {
  const {gasLimit, gasPrice, from, to, blockTime, confirmations} = transaction;
  return (
    <>
      <SharedTile title='Gas Limit' description={gasLimit} />
      <SharedTile
        title='Gas Price'
        description={`${getConvertedValue(gasPrice, 'ETH').toFixed(8)} ETH`}
      />
      <SharedTile title='From' description={from} />
      <SharedTile title='To' description={to} />
      {confirmations > 0 ? (
        <SharedTile title='Mined Time' description={getFormattedDate(blockTime)} />
      ) : null}
    </>
  );
};

export default TransactionSummaryEth;
