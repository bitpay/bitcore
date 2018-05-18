import express = require('express');
const router = express.Router({ mergeParams: true });
import { ChainStateProvider } from '../providers/chain-state';

router.get('/:address', function(req, res) {
  let { address, chain, network } = req.params;
  let { unspent } = req.query;
  let payload = {
    chain,
    network,
    address,
    stream: res,
    args: { unspent }
  };
  ChainStateProvider.streamAddressUtxos(payload);
});

router.get('/:address/balance', async function(req, res) {
  let { address, chain, network } = req.params;
  try {
    let result = await ChainStateProvider.getBalanceForAddress({
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
