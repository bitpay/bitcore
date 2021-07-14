import { Router } from 'express';
import logger from '../../logger';
import { ICoin } from '../../models/coin';
import { ITransaction } from '../../models/transaction';
import { ChainStateProvider } from '../../providers/chain-state';
import { StreamTransactionsParams } from '../../types/namespaces/ChainStateProvider';
import { SetCache } from '../middleware';
import { CacheTimes } from '../middleware';

const router = Router({ mergeParams: true });

router.get('/', function(req, res) {
  let { chain, network } = req.params;
  let { blockHeight, blockHash, limit, since, direction, paging } = req.query;
  if (!chain || !network) {
    return res.status(400).send('Missing required param');
  }
  if (!blockHash && !blockHeight) {
    return res.status(400).send('Must provide blockHash or blockHeight');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let payload: StreamTransactionsParams = {
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
  return ChainStateProvider.streamTransactions(payload);
});

router.get('/:txId', async (req, res) => {
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
      if (tx && tip && tx.blockHeight > 0 && tip.height - tx.blockHeight > 100) {
        SetCache(res, CacheTimes.Month);
      }
      return res.send(tx);
    }
  } catch (err) {
    return res.status(500).send(err);
  }
});

// Get transaction with input and outputs, assigned to key coins
router.get('/:txId/populated', async (req, res) => {
  let { chain, network, txId } = req.params;
  let txid = txId;
  if (typeof txid !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }

  try {
    let tx: ITransaction & { blockHeight: number; coins?: Array<ICoin> };
    let coins: any;
    let tip: any;

    [tx, coins, tip] = await Promise.all([
      ChainStateProvider.getTransaction({ chain, network, txId }),
      ChainStateProvider.getCoinsForTx({ chain, network, txid }),
      ChainStateProvider.getLocalTip({ chain, network })
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
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:txId/authhead', async (req, res) => {
  let { chain, network, txId } = req.params;
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
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:txid/coins', (req, res, next) => {
  let { chain, network, txid } = req.params;
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

router.post('/send', async function(req, res) {
  try {
    let { chain, network } = req.params;
    let { rawTx } = req.body;
    chain = chain.toUpperCase();
    network = network.toLowerCase();
    let txid = await ChainStateProvider.broadcastTransaction({
      chain,
      network,
      rawTx
    });
    return res.send({ txid });
  } catch (err) {
    logger.error(err);
    return res.status(500).send(err.message);
  }
});

module.exports = {
  router,
  path: '/tx'
};
