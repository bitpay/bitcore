import express = require('express');
const router = express.Router({ mergeParams: true });
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';

router.get('/:input', async function(req, res) {
  let { chain, network, input } = req.params;
  try {
    let isValid = await ChainStateProvider.isValid({
      chain,
      network,
      input
    });
    return res.send(isValid);
  } catch (err: any) {
    logger.error('Error checking network validity: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

module.exports = {
  router,
  path: '/valid'
};
