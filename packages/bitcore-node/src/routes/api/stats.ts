import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
import { AliasDataRequest, CacheTimes, SetCache } from '../middleware';
const router = require('express').Router({ mergeParams: true });

router.get('/', async function(_: Request, res: Response) {
  return res.send(404);
});

router.get('/daily-transactions', async function(req: Request, res: Response) {
  let { chain, network } = req as AliasDataRequest;
  try {
    let dailyTxs = await ChainStateProvider.getDailyTransactions({
      chain: chain as string,
      network: network as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    });
    SetCache(res, CacheTimes.Day);
    return res.json(dailyTxs);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router,
  path: '/stats'
};
