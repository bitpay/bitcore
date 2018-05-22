import { Router } from 'express';
import { CSP } from '../types/namespaces/ChainStateProvider';
import { ChainStateProvider } from '../providers/chain-state';
import logger from '../logger';
const router = Router({ mergeParams: true });

router.get('/', function(req, res) {
  let { chain, network } = req.params;
  if (!chain || !network) {
    return res.status(400).send('Missing required param');
  }
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let payload: CSP.StreamTransactionsParams = {
    chain,
    network,
    stream: res,
    args: {}
  };
  if (req.query.blockHeight) {
    payload.args.blockHeight = parseInt(req.query.blockHeight);
  }
  if (req.query.blockHash) {
    payload.args.blockHash = req.query.blockHash;
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
    return res.status(500).send(err);
  }
});
module.exports = {
  router: router,
  path: '/tx'
};
