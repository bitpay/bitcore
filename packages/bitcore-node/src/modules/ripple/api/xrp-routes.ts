import { Router } from 'express';
import logger from '../../../logger';
import { XRP } from './csp';

export const XrpRoutes = Router();

XrpRoutes.get('/api/XRP/:network/address/:address/txs/count', async (req, res) => {
  const { network, address } = req.params;
  try {
    const nonce = await XRP.getAccountNonce(network, address);
    res.json({ nonce });
  } catch (err: any) {
    logger.error('Error getting XRP account nonce: %o', err.stack || err.message || err);
    res.status(500).send(err.message || err);
  }
});

XrpRoutes.get('/api/XRP/:network/address/:address/flags', async (req, res) => {
  const { address, network } = req.params;
  try {
    const flags = await XRP.getAccountFlags(network, address);
    res.json({ flags });
  } catch (err: any) {
    logger.error('Error getting XRP account flags: %o', err.stack || err.message || err);
    res.status(500).send(err.message || err);
  }
});

XrpRoutes.get('/api/XRP/:network/reserve', async (req, res) => {
  const { network } = req.params;
  try {
    const reserve = await XRP.getReserve(network);
    res.json({ reserve });
  } catch (err: any) {
    logger.error('Error getting XRP reserve: %o', err.stack || err.message || err);
    res.status(500).send(err.message || err);
  }
});
