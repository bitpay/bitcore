import express, { Request, Response } from 'express';
import logger from '../../logger';
import { CoinStorage, ICoin } from '../../models/coin';
import { TransactionStorage } from '../../models/transaction';
import { ChainStateProvider } from '../../providers/chain-state';
import { CacheTimes, Confirmations, SetCache } from '../middleware';

const router = express.Router({ mergeParams: true });

router.get('/', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  let { sinceBlock, date, limit, since, direction, paging } = req.query as any;
  if (limit) {
    limit = parseInt(limit) || undefined; // if limit is NaN or null, set it to undefined so it'll fallback to CSP default
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
  } catch (err: any) {
    logger.error('Error getting blocks: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/tip', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  try {
    let tip = await ChainStateProvider.getLocalTip({ chain, network });
    return res.json(tip);
  } catch (err: any) {
    logger.error('Error getting tip block: %o:%o: %o', chain, network, err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/:blockId', async function(req: Request, res: Response) {
  let { chain, network, blockId } = req.params;
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
  } catch (err: any) {
    logger.error('Error getting blockId: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

// return all { txids, inputs, ouputs} for a blockHash paginated at max 500 per page, to limit reqs and overload
router.get('/:blockHash/coins/:limit/:pgnum', async function(req: Request, res: Response) {
  let { chain, network, blockHash, limit, pgnum } = req.params;

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

  let skips = maxLimit * (pageNumber - 1);
  let numOfTxs = await TransactionStorage.collection.find({ chain, network, blockHash }).count();
  try {
    let txs =
      numOfTxs < maxLimit
        ? await TransactionStorage.collection.find({ chain, network, blockHash }).toArray()
        : await TransactionStorage.collection
            .find({ chain, network, blockHash })
            .skip(skips)
            .limit(maxLimit)
            .toArray();

    if (!txs) {
      return res.status(422).send('No txs for page');
    }

    const txidIndexes: any = {};
    let txids = txs.map((tx, index) => {
      txidIndexes[index] = tx.txid;
      return tx.txid;
    });

    let inputs = await CoinStorage.collection
      .find({ chain, network, spentTxid: { $in: txids } })
      .addCursorFlag('noCursorTimeout', true)
      .toArray();

    let outputs = await CoinStorage.collection
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
  let { chain, network, time } = req.params;
  try {
    const block = await ChainStateProvider.getBlockBeforeTime({ chain, network, time });
    if (!block) {
      return res.status(404).send('block not found');
    }
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (block && tip && tip.height - block.height > Confirmations.Deep) {
      SetCache(res, CacheTimes.Month);
    }
    return res.json(block);
  } catch (err: any) {
    logger.error('Error getting blocks before time: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

module.exports = {
  router,
  path: '/block'
};
