import express, { Request } from 'express';
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';
import { AdapterError, AdapterErrorCode, AllProvidersUnavailableError } from '../../providers/chain-state/external/adapters/errors';
import { StreamAddressUtxosParams } from '../../types/namespaces/ChainStateProvider';

const router = express.Router({ mergeParams: true });

async function streamCoins(req: Request, res) {
  try {
    const { chain, network, address } = req.params;
    const { unspent, limit = 10, since } = req.query;
    const payload = {
      chain,
      network,
      address,
      req,
      res,
      args: { ...req.query, unspent, limit, since }
    } as StreamAddressUtxosParams;
    await ChainStateProvider.streamAddressTransactions(payload);
  } catch (err: any) {
    logger.error('Error streaming coins: %o', err.stack || err.message || err);
    if (err instanceof AllProvidersUnavailableError) {
      return res.status(503).json({ error: 'All indexed API providers unavailable', message: err.message });
    }
    if (err instanceof AdapterError && err.code === AdapterErrorCode.INVALID_REQUEST) {
      return res.status(400).json({ error: 'Invalid request', message: err.message });
    }
    return res.status(500).send(err.message || err);
  }
}

router.get('/:address', streamCoins);
router.get('/:address/txs', streamCoins);
router.get('/:address/coins', streamCoins);

router.get('/:address/balance', async function (req: Request, res) {
  const { address, chain, network } = req.params;
  try {
    const result = await ChainStateProvider.getBalanceForAddress({
      chain,
      network,
      address,
      args: req.query
    });
    return res.send(result || { confirmed: 0, unconfirmed: 0, balance: 0 });
  } catch (err: any) {
    logger.error('Error getting address balance: %o', err.stack || err.message || err);
    if (err instanceof AllProvidersUnavailableError) {
      return res.status(503).json({ error: 'All indexed API providers unavailable', message: err.message });
    }
    if (err instanceof AdapterError && err.code === AdapterErrorCode.INVALID_REQUEST) {
      return res.status(400).json({ error: 'Invalid request', message: err.message });
    }
    return res.status(500).send(err.message || err);
  }
});

export const addressRoute = {
  router,
  path: '/address'
};
