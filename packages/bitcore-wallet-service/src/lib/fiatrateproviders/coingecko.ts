module.exports = {
  name: 'Coingecko',
  url: 'https://api.coingecko.com/api/v3/exchanges/binance/tickers',
  parseFn(raw) {
    return [
      {
        code: 'USD',
        value: parseFloat(raw.last)
      }
    ];
  }
};
