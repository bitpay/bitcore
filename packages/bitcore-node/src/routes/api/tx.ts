import { SetCache } from '../middleware';
import { Router } from 'express';
import { CSP } from '../../types/namespaces/ChainStateProvider';
import { ChainStateProvider } from '../../providers/chain-state';
import logger from '../../logger';
import { TransactionJSON } from '../../types/Transaction';
import { CacheTimes } from '../middleware';
const Chain = require('../../chain');
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
  let payload: CSP.StreamTransactionsParams = {
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
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  try {
    const tx = await ChainStateProvider.getTransaction({ chain, network, txId });
    if (!tx) {
      return res.status(404).send(`The requested txid ${txId} could not be found.`);
    } else {
      const tip = await ChainStateProvider.getLocalTip({ chain, network });
      if (tx && tip.height - (<TransactionJSON>tx).blockHeight > 100) {
        SetCache(res, CacheTimes.Month);
      }
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

router.get('/:txId/coins', (req, res, next) => {
  let { chain, network, txId } = req.params;
  if (typeof txId !== 'string' || typeof chain !== 'string' || typeof network !== 'string') {
    res.status(400).send('Missing required param');
  } else {
    chain = chain.toUpperCase();
    network = network.toLowerCase();
    ChainStateProvider.getCoinsForTx({ chain, network, txid: txId })
      .then(coins => {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(JSON.stringify(coins));
      })
      .catch(next);
  }
});

router.get('/:txId/raw', (req, res, next) => {
  let { chain, network, txId } = req.params;
  if (typeof txId !== 'string' || typeof chain !== 'string' || typeof network !== 'string') {
    return res.status(400).send('Missing required param');
  } else {
    chain = chain.toUpperCase();
    network = network.toLowerCase();
    return Promise.all([
      ChainStateProvider.getTransaction({ chain, network, txId }),
      ChainStateProvider.getCoinsForTx({ chain, network, txid: txId })
    ])
      .then(async ([txJson, coins]) => {
        if (txJson === undefined) {
          return res.status(404).send(`Could not find transaction: ${txId}`);
        }
        if (coins === undefined) {
          return res.status(500).send(`Coin information is not available for transaction: ${txId}`);
        }
        const txData = {
          version: txJson.version,
          inputs: coins.inputs
            .sort((a, b) => (a.spentIndex < b.spentIndex ? -1 : 1))
            .map(input => ({
              prevTxId: input.mintTxid,
              outputIndex: input.mintIndex,
              sequenceNumber: input.inputSequenceNumber,
              script: input.unlockingScript
            })),
          outputs: coins.outputs
            .sort((a, b) => (a.mintIndex < b.mintIndex ? -1 : 1))
            .map(output => ({
              satoshis: output.value,
              script: output.lockingScript
            })),
          nLockTime: txJson.locktime
        };
        if (txJson.coinbase === true) {
          const coinbaseBlock = await ChainStateProvider.getBlock({ chain, network, blockId: txJson.blockHash });
          if (coinbaseBlock === undefined) {
            return res.status(500).send(`Some input information is not available for coinbase transaction: ${txId}`);
          }
          txData.inputs = [
            {
              prevTxId: coinbaseBlock.coinbaseMintTxId,
              outputIndex: coinbaseBlock.coinbaseMintIndex,
              sequenceNumber: coinbaseBlock.coinbaseSequenceNumber,
              script: coinbaseBlock.coinbaseUnlockingScript
            }
          ];
        }
        const tx = Chain[chain].lib.Transaction(txData);
        if (tx.hash !== txId) {
          return res.status(500).send(`Some database information appears to be corrupted for transaction: ${txId}`);
        }
        return tx.toBuffer().toString('hex');
      })
      .then((raw: string) => {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(raw);
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
  router: router,
  path: '/tx'
};
