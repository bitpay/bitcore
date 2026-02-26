import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
import { CacheTimes } from '../middleware';
import { CacheMiddleware } from '../middleware';
const router = require('express').Router({ mergeParams: true });
const feeCache = {};

router.get('/:target', CacheMiddleware(CacheTimes.Second), async (req: Request, res: Response) => {
  let { target, chain, network } = req.params;
  const targetNum = Number(target);
  if (targetNum < 0 || targetNum > 100) {
    return res.status(400).send('invalid target specified');
  }
  const cachedFee = feeCache[`${chain}:${network}:${target}`];
  if (cachedFee && cachedFee.date > Date.now() - 10 * 1000) {
    return res.json(cachedFee.fee);
  }
  try {
    let fee = await ChainStateProvider.getFee({ chain, network, target: targetNum });
    if (!fee) {
      return res.status(404).send('not available right now');
    }
    feeCache[`${chain}:${network}:${target}`] = { fee, date: Date.now() };
    return res.json(fee);
  } catch (err) {
    return res.status(500).send('Error getting fee from RPC');
  }
});

module.exports = {
  router,
  path: '/fee'
};
