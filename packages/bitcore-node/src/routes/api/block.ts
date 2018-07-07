import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
const router = require('express').Router({ mergeParams: true });

router.get('/', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  const { sinceBlock, date, limit } = req.query;
  try {
    let payload = {
      chain,
      network,
      sinceBlock,
      args: { date, limit },
      stream: res
    };
    return ChainStateProvider.getBlocks(payload);;
  } catch (err) {
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
    return res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/block'
};
