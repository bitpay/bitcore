const router = require('express').Router();
const ChainStateProvider = require('../providers/chain-state');

router.get('/:address', function(req, res) {
  let { address } = req.params;
  let { chain, network, unspent } = req.query;
  ChainStateProvider.getAddressUtxos(chain, network, address, res, {unspent});
});

router.get('/:address/balance', async function(req, res) {
  let { address } = req.params;
  let { chain, network } = req.query;
  try {
  let result = await ChainStateProvider.getBalanceForAddress(chain, network, address);
    res.send(result && result[0] || {balance: 0});
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/address'
};
