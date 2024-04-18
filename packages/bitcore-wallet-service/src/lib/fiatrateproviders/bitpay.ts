import { IProvider, IRates } from './provider';

export const BitPay: IProvider = {
  name: 'BitPay',
  getUrl(coin): string {
    return `https://bitpay.com/api/rates/${coin.toUpperCase()}?p=bws`;
  },
  parseFn(raw) {
    const rates: Array<IRates> = [];
    for (const d of raw) {
      if (d.code && d.rate) {
        rates.push({
          code: d.code,
          value: +d.rate
        });
      }
    }
    return rates;
  }
};
