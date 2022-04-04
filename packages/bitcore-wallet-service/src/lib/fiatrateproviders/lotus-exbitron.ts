import _ from 'lodash';

module.exports = {
  name: 'LotusExbitron',
  url: 'https://www.exbitron.com/api/v2/peatio/public/markets/xpiusdt/tickers',
  parseFn(raw) {
    const rate = raw.ticker.avg_price;
    return [{ code: 'USD', value: _.toNumber(rate) }];
  }
};
