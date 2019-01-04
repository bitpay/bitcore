import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
const router = require('express').Router({ mergeParams: true });

router.get('/', async function(_: Request, res: Response) {
  return res.send(404);
});

let cacheThroughTruncatedDate;
let cachedDailyTransactions;
router.get('/daily-transactions', async function(req: Request, res: Response) {
  const { chain, network } = req.params;
  const truncatedUTC = new Date().toISOString().split('T')[0];
  if (truncatedUTC === cacheThroughTruncatedDate) {
    return res.json(cachedDailyTransactions);
  }
  try {
    cachedDailyTransactions = await ChainStateProvider.getDailyTransactions({ chain, network });
    if (!cachedDailyTransactions) {
      return res.send(500);
    }
    cacheThroughTruncatedDate = truncatedUTC;
    return res.json(cachedDailyTransactions);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/stats'
};
