import { Router } from 'express';
import { CSP } from '../../types/namespaces/ChainStateProvider';
import { ChainStateProvider } from '../../providers/chain-state';
import logger from '../../logger';
const router = Router({ mergeParams: true });

router.get('/', function(req, res) {
  let { chain, network } = req.params;
  let { blockHeight, blockHash } = req.query;
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
    stream: res,
    args: {}
  };

  if (blockHeight) {
    payload.args.blockHeight = parseInt(blockHeight);
  }
  if (blockHash) {
    payload.args.blockHash = blockHash;
  }
  return ChainStateProvider.streamTransactions(payload);
});

router.get('/:txId', function(req, res) {
  let { chain, network, txId } = req.params;
  if (typeof txId !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  return ChainStateProvider.streamTransaction({ chain, network, txId, stream: res });
});

router.get('/:txid/coins', (req, res, next) => {
  let { chain, network, txid } = req.params;
  if (typeof txid !== 'string' || typeof chain !== 'string' || typeof network !== 'string') {
    res.status(400).send('Missing required param');
  }
  else {
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
  router: router,
  path: '/tx'
};
