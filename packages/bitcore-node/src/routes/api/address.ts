import express = require('express');
const router = express.Router({ mergeParams: true });
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';
import { StreamAddressUtxosParams } from '../../types/namespaces/ChainStateProvider';
import { AliasDataRequest } from '../middleware';

function streamCoins(req, res) {
  try {
    let { chain, network } = req as AliasDataRequest;
    let { address } = req.params;
    let { unspent, limit = 10, since } = req.query;
    let payload = {
      chain,
      network,
      address,
      req,
      res,
      args: { ...req.query, unspent, limit, since }
    } as StreamAddressUtxosParams;
    ChainStateProvider.streamAddressTransactions(payload);
  } catch (err) {
    logger.error('Error streaming coins: %o', err);
    return res.status(500).send(err);
  }
}

router.get('/:address', function(req, res) {
  try {
    let { chain, network } = req as AliasDataRequest;
    let { address } = req.params;
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
  } catch (err) {
    logger.error('Error getting address: %o', err);
    return res.status(500).send(err);
  }
});

router.get('/:address/txs', streamCoins);
router.get('/:address/coins', streamCoins);

router.get('/:address/balance', async function(req, res) {
  let { chain, network } = req as AliasDataRequest;
  let { address } = req.params;
  try {
    let result = await ChainStateProvider.getBalanceForAddress({
      chain: chain as string,
      network: network as string,
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
