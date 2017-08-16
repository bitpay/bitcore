const config = require('../../config');
const logger = require('../logger');
const request = require('request');

// Retrieve the configured endpoint's ticker rate at a
// set interval

const refreshInterval = config.api.currency_refresh >= 1 ?
                        config.api.currency_refresh * 1000 :
                        60 * 1000;
let lastRate          = 0;

getRate();

setInterval(() => {
  getRate();
}, refreshInterval);

// Make the request to the remote API
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
  // Return the ticker price
  app.get('/currency', (req, res) => {
    const data = {}
    data[config.api.ticker_prop] = lastRate;

    res.json({
      data,
    });
  });
};
