import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
import { SetCache, CacheTimes } from '../middleware';
const Chain = require('../../chain');
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

router.get('/tip', async function(req, res) {
  let { chain, network } = req.params;
  try {
    let tip = await ChainStateProvider.getBlock({ chain, network });
    return res.json(tip);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:blockId', async function(req, res) {
  let { blockId, chain, network } = req.params;
  try {
    let block = await ChainStateProvider.getBlock({ chain, network, blockId });
    if (!block) {
      return res.status(404).send('block not found');
    }
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (block && tip.height - block.height > 100) {
      SetCache(res, CacheTimes.Month);
    }
    return res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:blockId/raw', async function(req, res, next) {
  let { blockId, chain, network } = req.params;
  return ChainStateProvider.getBlock({ chain, network, blockId })
    .then(async block => {
      if (block === undefined) {
        return res.status(404).send(`Could not find block: ${blockId}`);
      }
      try {
        const header = Chain[chain].lib.BlockHeader({
          hash: block.hash,
          version: block.version,
          prevHash: block.previousBlockHash,
          merkleRoot: block.merkleRoot,
          time: new Date(block.time).getTime() / 1000,
          bits: block.bits,
          nonce: block.nonce
        });
        return header.toBuffer().toString('hex');
      } catch (e) {
        return res.status(500).send(`Some database information appears to be corrupted for block: ${blockId}`);
      }
    })
    .then((raw: string) => {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(raw);
    })
    .catch(next);
});

module.exports = {
  router: router,
  path: '/block'
};
