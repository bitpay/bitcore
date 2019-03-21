var _ = require('lodash');

module.exports = {
  name: 'BitPay',
  url: 'https://bitpay.com/api/rates/',
  parseFn(raw) {
    var rates = _.compact(
      _.map(raw, function(d) {
        if (!d.code || !d.rate) return null;
        return {
          code: d.code,
          value: d.rate
        };
      })
    );
    return rates;
  }
};
