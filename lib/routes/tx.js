const router = require('express').Router();
const JSONStream = require('JSONStream');

const Transaction = require('../models/transaction');

router.get('/', function(req, res) {
  let { chain, network } = req.query;
  if (!chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let query = {chain, network};
  if(req.query.blockHeight) {
    query.blockHeight = parseInt(req.query.blockHeight);
  }
  if(req.query.blockHash) {
    query.blockHash = req.query.blockHash;
  }
  Transaction.getTransactions({ query }).pipe(JSONStream.stringify()).pipe(res);
});

router.get('/:txid', function(req, res) {
  let { chain, network } = req.query;
  if (typeof txid !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let query = {chain, network, txid: req.params.txid};
  Transaction.getTransactions({ query }).pipe(JSONStream.stringify()).pipe(res);
});
module.exports = {
  router: router,
  path: '/tx'
};