const config = require('../../config');
const logger = require('../logger');
const request = require('request');

const refreshInterval = config.api.currency_refresh >= 1 ?
                        config.api.currency_refresh * 1000 :
                        60 * 1000;
let lastRate          = 0;

getRate();

setInterval(() => {
  getRate();
}, refreshInterval);

function getRate() {
  request(config.api.ticker_url, (err, res, body) => {
    if (err) {
      logger.log('error',
        `${err}`);
    }
    try {
      const ticker = JSON.parse(body);
      lastRate = ticker.last;
      logger.log('debug',
        `getRate: ${lastRate}`);
    } catch (error) {
      logger.log('error',
        `getRate: ${error}`);
    }
  });
}

module.exports = function currencyAPI(app) {
  app.get('/currency', (req, res) => {
    res.json({
      data: {
        bitstamp: lastRate,
      },
    });
  });
};
