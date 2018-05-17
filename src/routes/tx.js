const router = require('express').Router({ mergeParams: true });
const ChainStateProvider = require('../providers/chain-state');

router.get('/', function(req, res) {
  let { chain, network } = req.params;
  if (!chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let query = { chain, network };
  if (req.query.blockHeight) {
    query.blockHeight = parseInt(req.query.blockHeight);
  }
  if (req.query.blockHash) {
    query.blockHash = req.query.blockHash;
  }
  ChainStateProvider.streamTransactions(chain, network, res, query);
});

router.get('/:txid', function(req, res) {
  let { chain, network, txid } = req.params;
  if (typeof txid !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  ChainStateProvider.streamTransaction(chain, network, txid, res);
});

router.post('/send', async function(req, res) {
  let { chain, network } = req.params;
  let { rawTx } = req.body;
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let txid = await ChainStateProvider.broadcastTransaction(
    chain,
    network,
    rawTx
  );
  res.send({ txid });
});
module.exports = {
  router: router,
  path: '/tx'
};
