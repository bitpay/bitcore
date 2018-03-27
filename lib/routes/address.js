const router = require('express').Router({mergeParams: true});
const ChainStateProvider = require('../providers/chain-state');

router.get('/:address', function(req, res) {
  let { address, chain, network } = req.params;
  let { unspent } = req.query;
  ChainStateProvider.streamAddressUtxos(chain, network, address, res, {unspent});
});

router.get('/:address/balance', async function(req, res) {
  let { address, chain, network } = req.params;
  try {
    let result = await ChainStateProvider.getBalanceForAddress(chain, network, address);
    res.send(result && result[0] || {balance: 0});
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/address'
};
