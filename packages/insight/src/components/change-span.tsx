import {FC} from 'react';

export interface ChangeData {
  change: number;
  percentChange: number;
  range: number;
}

export const FeeChangeSpan: FC<{ data?: ChangeData }> = ({ data }) => {
  if (!data)
    return null;
  const { change, percentChange, range } = data;
  return (
    <span>
      <span style={{marginRight: '8px'}}>
        {change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sats/byte
        ({percentChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</span>
      <span style={{color: '#555'}}>Last {range} Days</span>
    </span>
  );
}

export const PriceChangeSpan: FC<{ data?: ChangeData }> = ({ data }) => {
  if (!data)
    return null;
  const { change, percentChange, range } = data;

  let color = 'gray';
  if (change > 0) {
    color = 'green';
  } else if (change < 0) {
    color = 'red';
  }
  
  return (
    <span>
      <span style={{color, marginRight: '8px'}}>
      ${change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
      ({percentChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
      </span>
      <span style={{color: '#555'}}>Last {range} Hours</span>
    </span>
  );
}