import express = require('express');
const router = express.Router({ mergeParams: true });
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';

function streamCoins(req, res) {
  try {
    let { address, chain, network } = req.params;
    let { unspent, limit = 10, since } = req.query;
    let payload = {
      chain,
      network,
      address,
      req,
      res,
      args: { ...req.query, unspent, limit, since }
    };
    ChainStateProvider.streamAddressTransactions(payload);
  } catch (err: any) {
    logger.error('Error streaming coins: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
}

router.get('/:address', function(req, res) {
  try {
    let { address, chain, network } = req.params;
    let { unspent, limit = 10, since } = req.query;
    let payload = {
      chain,
      network,
      address,
      req,
      res,
      args: { unspent, limit, since }
    };
    return ChainStateProvider.streamAddressUtxos(payload);
  } catch (err) {
    logger.error('Error getting address: %o', err);
    return res.status(500).send(err);
  }
});

router.get('/:address/txs', streamCoins);
router.get('/:address/coins', streamCoins);

router.get('/:address/balance', async function(req, res) {
  let { address, chain, network } = req.params;
  try {
    let result = await ChainStateProvider.getBalanceForAddress({
      chain,
      network,
      address,
      args: req.query
    });
    return res.send(result || { confirmed: 0, unconfirmed: 0, balance: 0 });
  } catch (err) {
    logger.error('Error getting address balance: %o', err);
    return res.status(500).send(err);
  }
});

module.exports = {
  router,
  path: '/address'
};
