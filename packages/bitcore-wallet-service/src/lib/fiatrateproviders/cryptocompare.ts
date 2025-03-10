import _ from 'lodash';
import { Common } from '../common';
import Config from '../../config';

const Defaults = Common.Defaults;

module.exports = {
  name: 'CryptoCompare',
  url: 'https://min-api.cryptocompare.com/data/price',
  params: {
    fsym: '',
    tsyms: Defaults.FIAT_CURRENCY.code
  },
  headers: {
    authorization: Config.fiatRateServiceOpts?.cryptoCompareApiKey ?? ''
  },
  parseFn(raw) {
    const rates = _.compact(
      Object.keys(raw).map(key => {
        if (!raw[key]) return null;
        return {
          code: key,
          value: +raw[key]
        };
      })
    );
    return rates;
  }
};
