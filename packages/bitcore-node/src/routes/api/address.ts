import express = require('express');
const router = express.Router({ mergeParams: true });
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';
import { StreamAddressUtxosParams } from '../../types/namespaces/ChainStateProvider';

async function streamCoins(req, res) {
  try {
    let { chain, network, address } = req.params;
    let { unspent, limit = 10, since } = req.query;
    let payload = {
      chain,
      network,
      address,
      req,
      res,
      args: { ...req.query, unspent, limit, since }
    } as StreamAddressUtxosParams;
    await ChainStateProvider.streamAddressTransactions(payload);
  } catch (err: any) {
    logger.error('Error streaming coins: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
}

router.get('/:address', function (req, res) {
  try {
    let { chain, network, address } = req.params;
    let { unspent, limit = 10, since } = req.query;
    let payload = {
      chain,
      network,
      address,
      req,
      res,
      args: { unspent, limit, since }
    } as StreamAddressUtxosParams;
    return ChainStateProvider.streamAddressUtxos(payload);
  } catch (err: any) {
    logger.error('Error getting address: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/:address/txs', streamCoins);
router.get('/:address/coins', streamCoins);

router.get('/:address/balance', async function (req, res) {
  let { address, chain, network } = req.params;
  try {
    let result = await ChainStateProvider.getBalanceForAddress({
      chain,
      network,
      address,
      args: req.query
    });
    return res.send(result || { confirmed: 0, unconfirmed: 0, balance: 0 });
  } catch (err: any) {
    logger.error('Error getting address balance: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

module.exports = {
  router,
  path: '/address'
};
