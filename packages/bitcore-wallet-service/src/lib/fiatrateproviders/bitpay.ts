import _ from 'lodash';

module.exports = {
  name: 'BitPay',
  url: 'https://bitpay.com/api/rates/',
  parseFn(raw) {
    const rates = _.compact(
      _.map(raw, d => {
        if (!d.code || !d.rate) return null;
        return {
          code: d.code,
          value: +d.rate
        };
      })
    );
    return rates;
  }
};
