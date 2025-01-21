import { IProvider, IRates } from './provider';

export const Bitstamp: IProvider = {
  name: 'Bitstamp',
  getUrl(coin): string {
    return `https://www.bitstamp.net/api/ticker/${coin}`;
  },
  parseFn(raw): Array<IRates> {
    return [
      {
        code: 'USD',
        value: parseFloat(raw.last)
      }
    ];
  }
};
