import {FC, memo} from 'react';
import {Transaction} from '../utilities/models';
import {SharedTile} from './shared';

interface TransactionSummaryProps {
  transaction: Transaction;
}
const TransactionSummary: FC<TransactionSummaryProps> = ({transaction}) => {
  const {size, fee} = transaction;
  return (
    <>
      <SharedTile title='Size' description={`${size} bytes`} />
      {fee >= 0 && size ? (
        <SharedTile title='Fee Rate' description={`${(fee / size).toFixed(2)} sats/byte`} />
      ) : null}
      <SharedTile title='Fee' description={`${fee} sats`} />
    </>
  );
};

export default memo(TransactionSummary);
