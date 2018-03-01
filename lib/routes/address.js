const router = require('express').Router();

const Storage = require('../services/storage');
const Coin = require('../models/coin');

router.get('/:address', function(req, res) {
  let { address } = req.params;
  let { chain, network, unspent } = req.query;
  if (typeof address !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let query = {chain, network, address};
  if (unspent) {
    query.spentHeight = { $lt: 0 };
  }
  Storage.apiStreamingFind(Coin, query, req.query, res);
});

router.get('/:address/balance', async function(req, res) {
  let { address } = req.params;
  let { chain, network } = req.query;
  if (typeof address !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let query = {chain, network, address};
  let balance = Coin.getBalance({ query });
  try {
    let result = await balance.exec();
    res.send(result && result[0] || {balance: 0});
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/address'
};