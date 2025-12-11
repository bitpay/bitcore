import {FC} from 'react';
import {useBlocks} from 'src/contexts';

export const FeeChangeSpan: FC<{ range: string }> = ({ range }) => {
  const { blocks } = useBlocks();
  if (!blocks)
    return null;

  const numBlocks = Number(range.slice(0, range.indexOf(' ')));
  const fees = blocks?.map(block => block.feeData.median as number);
  const change = fees[0] - fees[numBlocks];
  const percentChange = change / fees[numBlocks] * 100;

  return (
    <span>
      <span style={{marginRight: '8px'}}>
        {change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sats/byte
        ({percentChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</span>
      <span style={{color: '#555'}}>Last {numBlocks} Blocks</span>
    </span>
  );
}

export const PriceChangeSpan: FC<{ prices: number[], lastPrice: number, range: string }> = ({ prices, lastPrice, range }) => {
  const hours = Number(range.slice(0, range.indexOf(' ')));
  const change = lastPrice - prices[prices.length - hours];
  const percentChange = change / prices[prices.length - hours] * 100;

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
      <span style={{color: '#555'}}>Last {hours} Hours</span>
    </span>
  );
}