import express = require('express');
import config from '../config';
import { PerformanceTracker } from '../decorators/Loggify';
import { StateStorage } from '../models/state';
import { ChainNetwork } from '../types/ChainNetwork';
const router = express.Router({ mergeParams: true });

router.get('/enabled-chains', function(_, res) {
  const chainNetworks = new Array<ChainNetwork>();
  for (let chain of Object.keys(config.chains)) {
    for (let network of Object.keys(config.chains[chain])) {
      chainNetworks.push({ chain, network });
    }
  }
  res.json(chainNetworks);
});

router.get('/performance', function(_, res) {
  res.json(PerformanceTracker);
});

router.get('/:chain/:network/sync', async function(req, res) {
  let { chain, network } = req.params;
  const state = await StateStorage.collection.findOne({});
  const initialSyncComplete =
    state && state.initialSyncComplete && state.initialSyncComplete.includes(`${chain}:${network}`);
  res.json({ initialSyncComplete });
});

module.exports = {
  router,
  path: '/status'
};
