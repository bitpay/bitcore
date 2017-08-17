const logger  = require('../logger');
const request = require('request');
const config  = require('../../config');
const util    = require('../util');

const API_URL = `http://${config.bcoin_http}:${config.bcoin['http-port']}`;
const TTL = config.api.request_ttl;

module.exports = function AddressAPI(router) {
  router.get('/addr/:addr', (req, res) => {
    const addr = req.params.addr || '';

    if (!util.isBitcoinAddress(addr)) {
      return res.status(400).send({
        error: 'Invalid bitcoin address',
      });
    }

    logger.log('debug',
      'Warning: Requesting data from Bcoin by address, may take some time');
    // Get Bcoin data
    return request(`${API_URL}/tx/address/${addr}`,
      { timeout: TTL },
      (error, bcoinRes, bcoinTxs) => {
        if (error) {
          logger.log('error',
            `${error}`);
          return res.status(404).send({});
        }
        let txs = {};
        try {
          txs = JSON.parse(bcoinTxs);
        } catch (e) {
          logger.log('error',
            `${e}`);
          return res.status(404).send({});
        }

        // Sum the matching outputs for every tx
        const totalReceived = txs.reduce((total, tx) => total + tx.outputs.reduce((sum, output) => {
          if (output.address === req.params.addr) {
            return sum + output.value;
          }
          return sum;
        }, 0), 0) || 0;

        // Sum the matching inputs for every tx
        const totalSpent = txs.reduce((total, tx) => total + tx.inputs.reduce((sum, input) => {
          if (input.coin && input.coin.address === req.params.addr) {
            return sum + input.coin.value;
          }
          return sum;
        }, 0), 0) || 0;

        // Match Insight API
        return res.json({
          addrStr:                 req.params.addr,
          balance:                 (totalReceived - totalSpent) / 1e8,
          balanceSat:              totalReceived - totalSpent,
          totalReceived:           totalReceived / 1e8,
          totalReceivedSat:        totalReceived,
          totalSent:               totalSpent / 1e8,
          totalSentSat:            totalSpent,
          unconfirmedBalance:      0,
          unconfirmedBalanceSat:   0,
          unconfirmedTxApperances: 0,
          txApperances:            txs.length,
        });
      });
  });

  // Stubbed by # to help with tasking
  router.get('/addr/:addr/utxo', (req, res) => {
    res.send('1');
  });

  router.get('/addr/:addr/balance', (req, res) => {
    res.send('2');
  });

  router.get('/addr/:addr/totalReceived', (req, res) => {
    res.send('3');
  });

  router.get('/addr/:addr/totalSent', (req, res) => {
    res.send('4');
  });

  router.get('/addr/:addr/unconfirmedBalance', (req, res) => {
    res.send('5');
  });

  router.get('/addrs/:addrs/utxo', (req, res) => {
    res.send('6');
  });

  router.post('/addrs/utxo', (req, res) => {
    res.send('7');
  });

  router.get('/addrs/:addrs/txs', (req, res) => {
    res.send('8');
  });

  router.post('/addrs/txs', (req, res) => {
    res.send('9');
  });
};
