import express = require('express');
const router = express.Router({ mergeParams: true });
import { ChainStateProvider } from '../../providers/chain-state';

router.get('/:input', async function(req, res) {
  let { input, chain, network } = req.params;
  try {
    let isValid = await ChainStateProvider.isValid({
      chain,
      network,
      input
    });
    return res.send(isValid);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router,
  path: '/valid'
};
