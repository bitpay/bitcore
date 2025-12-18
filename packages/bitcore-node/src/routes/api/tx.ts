import { Request, Response, Router } from 'express';
import logger from '../../logger';
import { ICoin } from '../../models/coin';
import { ITransaction } from '../../models/transaction';
import { ChainStateProvider } from '../../providers/chain-state';
import { StreamTransactionsParams } from '../../types/namespaces/ChainStateProvider';
import { SetCache } from '../middleware';
import { CacheTimes } from '../middleware';

const router = Router({ mergeParams: true });

router.get('/', async function(req: Request, res: Response) {
  try {
    let { chain, network } = req.params;
    const { blockHeight, blockHash, limit, since, direction, paging } = req.query as any;
    if (!chain || !network) {
      return res.status(400).send('Missing required param');
    }
    if (!blockHash && !blockHeight) {
      return res.status(400).send('Must provide blockHash or blockHeight');
    }
    chain = chain.toUpperCase();
    network = network.toLowerCase();
    const payload: StreamTransactionsParams = {
      chain,
      network,
      req,
      res,
      args: { limit, since, direction, paging }
    };

    if (blockHeight !== undefined) {
      payload.args.blockHeight = parseInt(blockHeight);
    }
    if (blockHash !== undefined) {
      payload.args.blockHash = blockHash;
    }
    return await ChainStateProvider.streamTransactions(payload);
  } catch (err: any) {
    logger.error('Error streaming wallet utxos: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/:txId', async (req: Request, res: Response) => {
  let { chain, network, txId } = req.params;
  if (typeof txId !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }
  txId = txId
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  try {
    const tx = await ChainStateProvider.getTransaction({ chain, network, txId });
    if (!tx) {
      return res.status(404).send(`The requested txid ${txId} could not be found.`);
    } else {
      const tip = await ChainStateProvider.getLocalTip({ chain, network });
      if (tx && tip && tx.blockHeight > -1 && tip.height - tx.blockHeight > 100) {
        SetCache(res, CacheTimes.Month);
      }
      return res.send(tx);
    }
  } catch (err: any) {
    logger.error('Error getting transaction: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

// Get transaction with input and outputs, assigned to key coins
router.get('/:txId/populated', async (req: Request, res: Response) => {
  const { chain, network, txId } = req.params;
  const txid = txId;
  if (typeof txid !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }

  try {
    const [tx, coins, tip] = await Promise.all([
      ChainStateProvider.getTransaction({ chain, network, txId }) as Promise<ITransaction & { blockHeight: number; coins?: Array<ICoin> }>,
      ChainStateProvider.getCoinsForTx({ chain, network, txid }) as any, // must cast as any so tx.coins can be set to coins
      ChainStateProvider.getLocalTip({ chain, network }) as any
    ]);

    if (!tx) {
      return res.status(404).send(`The requested txid ${txid} could not be found.`);
    } else {
      if (tx && tip && tx.blockHeight > 0 && tip.height - tx.blockHeight > 100) {
        SetCache(res, CacheTimes.Month);
      }

      if (!coins) {
        res.status(404).send(`The requested coins for txid ${txid} could not be found.`);
      }
      tx.coins = coins;
      return res.send(tx);
    }
  } catch (err: any) {
    logger.error('Error getting populated transaction: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/:txId/authhead', async (req: Request, res: Response) => {
  let { chain, network } = req.params;
  const { txId } = req.params;

  if (typeof txId !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  try {
    const authhead = await ChainStateProvider.getAuthhead({ chain, network, txId });
    if (!authhead) {
      return res.status(404).send(`Authhead for txid ${txId} could not be found.`);
    } else {
      return res.send(authhead);
    }
  } catch (err: any) {
    logger.error('Error getting transaction authhead: %o', err.stack || err.message || err);
    return res.status(500).send(err.message || err);
  }
});

router.get('/:txid/coins', (req: Request, res: Response, next) => {
  let { chain, network } = req.params;
  const { txid } = req.params;
  if (typeof txid !== 'string' || typeof chain !== 'string' || typeof network !== 'string') {
    res.status(400).send('Missing required param');
  } else {
    chain = chain.toUpperCase();
    network = network.toLowerCase();
    ChainStateProvider.getCoinsForTx({ chain, network, txid })
      .then(coins => {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(JSON.stringify(coins));
      })
      .catch(next);
  }
});

router.post('/send', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  const { rawTx } = req.body;
  try {
    if (typeof rawTx !== 'string' && !Array.isArray(rawTx)) {
      return res.status(400).send('Invalid rawTx');
    }
    if (Array.isArray(rawTx) && !rawTx.every(tx => typeof tx === 'string')) {
      return res.status(400).send('Invalid array of rawTx');
    }
    chain = chain.toUpperCase();
    network = network.toLowerCase();
    const txid = await ChainStateProvider.broadcastTransaction({
      chain,
      network,
      rawTx
    });
    return res.send({ txid });
  } catch (err: any) {
    logger.error('Broadcast error: %o %o %o %o', chain, network, rawTx, err.stack || err.message || err);
    return res.status(500).send(err.message);
  }
});

export const txRoute = {
  router,
  path: '/tx'
};
