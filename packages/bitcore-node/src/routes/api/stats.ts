import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
import { SetCache, CacheTimes } from '../middleware';

const router = require('express').Router({ mergeParams: true });

router.get('/', async function(_: Request, res: Response) {
  return res.send(404);
});

let cache = {};
let updating = false;

router.get('/daily-transactions', async function(req: Request, res: Response) {
  const { chain, network } = req.params;
  const cacheKey = chain + ':' + network;
  const updateCache = async () => {
    const hasFreshData = cache[cacheKey] && cache[cacheKey].expiry > Date.now();
    if (!updating && !hasFreshData) {
      updating = true;
      try {
        let dailyTxs = await ChainStateProvider.getDailyTransactions({
          chain,
          network,
          startDate: '',
          endDate: ''
        });
        cache[cacheKey] = { dailyTxs, expiry: Date.now() + CacheTimes.Day };
        updating = false;
      } catch (e) {
        updating = false;
      }
    }
    return cache[cacheKey];
  };
  try {
    const { dailyTxs } = await updateCache();
    SetCache(res, CacheTimes.Day, CacheTimes.Hour);
    return res.json(dailyTxs);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/stats'
};
