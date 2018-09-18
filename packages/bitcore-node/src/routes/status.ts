import express = require('express');
import { PerformanceTracker } from '../decorators/Loggify';
import config from '../config';
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

module.exports = {
  router: router,
  path: '/status'
};
