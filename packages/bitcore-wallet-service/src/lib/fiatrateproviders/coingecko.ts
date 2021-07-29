import _ from 'lodash';
const Common = require('../common');
const Defaults = Common.Defaults;

module.exports = {
  name: 'Coingecko',
  url: 'https://api.coingecko.com/api/v3/simple/price',
  params: {
    ids: '',
    vs_currencies: Defaults.FIAT_CURRENCIES.map(currency => currency.code).join(',')
  },
  coinMapping: {
    'btc': 'bitcoin',
    'bch': 'binance-peg-bitcoin-cash',
    'xec': 'ecash',
    'eth': 'ethereum',
    'xrp': 'ripple',
    'doge': 'binance-peg-dogecoin'
  },
  parseFn(raw) {
    const valueObject = Object.values(raw)[0];
    const rates = _.compact(
      Object.keys(valueObject).map(key => {
        if (!valueObject[key]) return null;
        return {
          code: key.toUpperCase(),
          value: +valueObject[key]
        };
      })
    );
    return rates;
  }
};
