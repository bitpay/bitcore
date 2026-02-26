import {Transaction} from '../utilities/models';
import {SharedTile} from './shared';

const TransactionSummary = ({transaction}: {transaction: Transaction}) => {
  const {size, fee} = transaction;
  return (
    <>
      <SharedTile title='Size' description={`${size} (bytes)`} />
      {fee >= 0 && size ? (
        <SharedTile title='Fee Rate' description={`${(fee / size).toFixed(2)} sats/bytes`} />
      ) : null}
    </>
  );
};

export default TransactionSummary;
