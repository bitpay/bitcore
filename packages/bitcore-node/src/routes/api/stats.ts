import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
import { SetCache, CacheTimes } from '../middleware';
import logger from '../../logger';

const router = require('express').Router({ mergeParams: true });

router.get('/', async function(_: Request, res: Response) {
  return res.send(404);
});

let cache = {};
let cacheExpiry = Date.now() + CacheTimes.Day;
let updating = false;

router.get('/daily-transactions', async function(req: Request, res: Response) {
  const { chain, network } = req.params;
  const cacheKey = chain + ':' + network;
  const updateCache = async () => {
    try {
      const hasFreshData = cache[cacheKey] && cacheExpiry > Date.now();
      if (!updating && !hasFreshData) {
        updating = true;
        cache = {};
        let dailyTxs = await ChainStateProvider.getDailyTransactions({
          chain,
          network,
          startDate: req.query.startDate,
          endDate: req.query.endDate
        });
        cache[cacheKey] = dailyTxs;
      }
    } catch (e) {
      logger.error(e);
    } finally {
      updating = false;
      return cache[cacheKey];
    }
  };
  try {
    const dailyTxs = await updateCache();
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
