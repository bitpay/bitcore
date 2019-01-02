var provider = {
  name: 'Bitstamp',
  url: 'https://www.bitstamp.net/api/ticker/',
  parseFn: function(raw) {
    return [{
      code: 'USD',
      value: parseFloat(raw.last)
    }];
  }
};

module.exports = provider;
