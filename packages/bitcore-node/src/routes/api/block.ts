import { Request, Response } from 'express';
import { InternalState } from '../../providers/chain-state';
const router = require('express').Router({ mergeParams: true });

router.get('/', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  const { sinceBlock, date, limit, since, direction, paging } = req.query;
  try {
    let payload = {
      chain,
      network,
      sinceBlock,
      args: { date, limit, since, direction, paging },
      stream: res
    };
    return InternalState.streamBlocks(payload);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/tip', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  try {
    let tip = await InternalState.getBlock({ chain, network });
    return res.json(tip);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:blockId', async function(req: Request, res: Response) {
  let { blockId, chain, network } = req.params;
  try {
    let block = await InternalState.getBlock({ chain, network, blockId });
    if (!block) {
      return res.status(404).send('block not found');
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
