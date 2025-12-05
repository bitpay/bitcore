import express, { Request, Response } from 'express';
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';
import { CacheTimes, SetCache } from '../middleware';

const router = express.Router({ mergeParams: true });

router.get('/', async function(_: Request, res: Response) {
  return res.send(404);
});

router.get('/daily-transactions', async function(req: Request, res: Response) {
  const { chain, network } = req.params;
  try {
    const dailyTxs = await ChainStateProvider.getDailyTransactions({
      chain,
      network,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    });
    SetCache(res, CacheTimes.Day);
    return res.json(dailyTxs);
  } catch (err: any) {
    logger.error('Error getting daily transactions: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

export const statsRoute = {
  router,
  path: '/stats'
};
