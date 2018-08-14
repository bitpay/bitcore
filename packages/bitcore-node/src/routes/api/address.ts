import express = require('express');
const router = express.Router({ mergeParams: true });
import { InternalState } from '../../providers/chain-state';

router.get('/:address/txs', function(req, res) {
  let { address, chain, network } = req.params;
  let { unspent, limit = 10 } = req.query;
  let payload = {
    chain,
    network,
    address,
    limit,
    stream: res,
    args: { unspent }
  };
  InternalState.streamAddressTransactions(payload);
});

router.get('/:address', function(req, res) {
  let { address, chain, network } = req.params;
  let { unspent, limit = 10 } = req.query;
  let payload = {
    chain,
    network,
    address,
    limit,
    stream: res,
    args: { unspent }
  };
  InternalState.streamAddressUtxos(payload);
});

router.get('/:address/balance', async function(req, res) {
  let { address, chain, network } = req.params;
  try {
    let result = await InternalState.getBalanceForAddress({
      chain,
      network,
      address
    });
    return res.send((result && result[0]) || { balance: 0 });
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/address'
};
