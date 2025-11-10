import express from 'express';
import { Config } from '../../src/services/config';
import { PerformanceTracker } from '../decorators/Loggify';
import { StateStorage } from '../models/state';
import { ChainNetwork } from '../types/ChainNetwork';

const router = express.Router({ mergeParams: true });

router.get('/enabled-chains', function(_, res) {
  const chainNetworks = new Array<ChainNetwork>();
  for (const chain of Object.keys(Config.get().chains)) {
    for (const network of Object.keys(Config.get().chains[chain])) {
      chainNetworks.push({ chain, network });
    }
  }
  res.json(chainNetworks);
});

router.get('/performance', function(_, res) {
  res.json(PerformanceTracker);
});

router.get('/:chain/:network/sync', async function(req, res) {
  const { chain, network } = req.params;
  const state = await StateStorage.collection.findOne({});
  const initialSyncComplete =
    state && state.initialSyncComplete && state.initialSyncComplete.includes(`${chain}:${network}`);
  res.json({ initialSyncComplete });
});

export const statusRoute = {
  router,
  path: '/status'
};
