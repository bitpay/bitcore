import express, { Request, Response } from 'express';
import { LRUCache } from 'lru-cache';
import logger from '../../logger';
import { CoinStorage, ICoin } from '../../models/coin';
import { TransactionStorage } from '../../models/transaction';
import { ChainStateProvider } from '../../providers/chain-state';
import { isDateValid } from '../../utils';
import { CacheTimes, Confirmations, SetCache } from '../middleware';

const router = express.Router({ mergeParams: true });
const feeCache = new LRUCache({ max: 6000 });

router.get('/', async function(req: Request, res: Response) {
  const { chain, network } = req.params;
  const { sinceBlock, date, since, direction, paging } = req.query as any;
  let { limit } = req.query as any;
  if (limit) {
    limit = parseInt(limit) || undefined; // if limit is NaN or null, set it to undefined so it'll fallback to CSP default
  }
  try {
    const payload = {
      chain,
      network,
      sinceBlock,
      args: { date, limit, since, direction, paging },
      req,
      res
    };
    return ChainStateProvider.streamBlocks(payload);
  } catch (err: any) {
    logger.error('Error getting blocks: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/tip', async function(req: Request, res: Response) {
  const { chain, network } = req.params;
  try {
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    return res.json(tip);
  } catch (err: any) {
    logger.error('Error getting tip block: %o:%o: %o', chain, network, err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/:blockId', async function(req: Request, res: Response) {
  const { chain, network, blockId } = req.params;
  try {
    const block = await ChainStateProvider.getBlock({ chain, network, blockId });
    if (!block) {
      return res.status(404).send('block not found');
    }
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (block && tip && tip.height - block.height > Confirmations.Deep) {
      SetCache(res, CacheTimes.Month);
    }
    return res.json(block);
  } catch (err: any) {
    logger.error('Error getting blockId: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

// return all { txids, inputs, ouputs} for a blockHash paginated at max 500 per page, to limit reqs and overload
router.get('/:blockHash/coins/:limit/:pgnum', async function(req: Request, res: Response) {
  const { chain, network, blockHash, limit, pgnum } = req.params;

  let pageNumber;
  let maxLimit;
  try {
    pageNumber = parseInt(pgnum, 10);
    maxLimit = parseInt(limit, 10);

    if (maxLimit) {
      if (maxLimit > 500) maxLimit = 500;
    }
  } catch (err) {
    console.log(err);
  }

  const skips = maxLimit * (pageNumber - 1);
  const numOfTxs = await TransactionStorage.collection.countDocuments({ chain, network, blockHash });
  try {
    const txs = await TransactionStorage.collection
      .find({ chain, network, blockHash })
      .skip(skips)
      .limit(maxLimit)
      .toArray();

    if (!txs) {
      return res.status(422).send('No txs for page');
    }

    const txidIndexes: any = {};
    const txids = txs.map((tx, index) => {
      txidIndexes[index] = tx.txid;
      return tx.txid;
    });

    const inputs = await CoinStorage.collection
      .find({ chain, network, spentTxid: { $in: txids } })
      .addCursorFlag('noCursorTimeout', true)
      .toArray();

    const outputs = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: txids } })
      .addCursorFlag('noCursorTimeout', true)
      .toArray();

    let prevPageNum;
    let nxtPageNum;
    let previous = '';
    let next = '';
    if (pageNumber !== 1) {
      prevPageNum = parseInt(pageNumber) - 1;
      previous = `/block/${blockHash}/coins/${maxLimit}/${prevPageNum}`;
    }
    if (numOfTxs - maxLimit * pageNumber > 0) {
      nxtPageNum = pageNumber + 1;
      next = `/block/${blockHash}/coins/${maxLimit}/${nxtPageNum}`;
    }

    const sanitize = (coins: Array<ICoin>) => coins.map(c => CoinStorage._apiTransform(c, { object: true }));
    return res.json({ txids, inputs: sanitize(inputs), outputs: sanitize(outputs), previous, next });
  } catch (err: any) {
    logger.error('Error getting block hash data: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/before-time/:time', async function(req: Request, res: Response) {
  const { chain, network, time } = req.params;
  try {
    if (!isDateValid(time)) {
      return res.status(400).send('Invalid time parameter');
    }
    const block = await ChainStateProvider.getBlockBeforeTime({ chain, network, time });
    if (!block) {
      return res.status(404).send('block not found');
    }
    let tip;
    try {
      tip = await ChainStateProvider.getLocalTip({ chain, network });
    } catch (err: any) {
      logger.error('Error getting local tip: %o', err.stack || err.message || err);
    }
    if (block && tip && tip.height - block.height > Confirmations.Deep) {
      SetCache(res, CacheTimes.Month);
    }
    return res.json(block);
  } catch (err: any) {
    logger.error('Error getting blocks before time: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/:blockId/fee', async function(req: Request, res: Response) {
  const { chain, network } = req.params;
  let { blockId } = req.params;

  if (blockId === 'tip') {
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (!tip) {
      return res.status(404).send(`tip not found for ${chain}:${network}`);
    }
    blockId = tip.height.toString();
  }
  
  const feeCacheKey = `${chain}:${network}:${blockId}`;
  if (feeCache.has(feeCacheKey)) {
    return res.send(feeCache.get(feeCacheKey));
  }

  const fee = await ChainStateProvider.getBlockFee({ chain, network, blockId });  
  if (!fee) {
    logger.error(`block not found with id ${blockId}`);
    return res.status(404).send(`block not found with id ${blockId}`);
  }
  feeCache.set(feeCacheKey, fee);
  return res.json(fee);
});

export const blockRoute = {
  router,
  path: '/block'
};
