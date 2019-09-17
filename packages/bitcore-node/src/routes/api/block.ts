import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
import { SetCache, CacheTimes, Confirmations } from '../middleware';
import { BitcoinBlockStorage } from '../../models/block';
const router = require('express').Router({ mergeParams: true });

router.get('/', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  let { sinceBlock, date, limit, since, direction, paging } = req.query;
  if (limit) {
    limit = parseInt(limit);
  }
  try {
    let payload = {
      chain,
      network,
      sinceBlock,
      args: { date, limit, since, direction, paging },
      req,
      res
    };
    return ChainStateProvider.streamBlocks(payload);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/tip', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  try {
    let tip = await ChainStateProvider.getBlock({ chain, network });
    return res.json(tip);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});

router.get('/:blockId', async function(req: Request, res: Response) {
  let { blockId, chain, network } = req.params;
  try {
    let block = await ChainStateProvider.getBlock({ chain, network, blockId });
    if (!block) {
      return res.status(404).send('block not found');
    }
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (block && tip && tip.height - block.height > Confirmations.Deep) {
      SetCache(res, CacheTimes.Month);
    }
    return res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/before-time/:time', async function(req: Request, res: Response) {
  let { time, chain, network } = req.params;
  try {
    const [block] = await BitcoinBlockStorage.collection
      .find({
        chain,
        network,
        timeNormalized: { $lte: new Date(time) }
      })
      .limit(1)
      .sort({ timeNormalized: -1 })
      .toArray();

    if (!block) {
      return res.status(404).send('block not found');
    }
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (block && tip && tip.height - block.height > Confirmations.Deep) {
      SetCache(res, CacheTimes.Month);
    }
    return res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/block'
};
