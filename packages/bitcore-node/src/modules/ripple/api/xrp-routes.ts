import { Router } from 'express';
import { AliasDataRequest } from '../../../routes/middleware';
import { XRP } from './csp';
export const XrpRoutes = Router();

XrpRoutes.get('/api/:chain/:network/address/:address/txs/count', async (req, res) => {
  let { network } = req as AliasDataRequest;
  let { address } = req.params;
  try {
    const nonce = await XRP.getAccountNonce(network as string, address);
    res.json({ nonce });
  } catch (err) {
    res.status(500).send(err);
  }
});

XrpRoutes.get('/api/XRP/:network/address/:address/flags', async (req, res) => {
  let { address, network } = req.params;
  try {
    const flags = await XRP.getAccountFlags(network, address);
    res.json({ flags });
  } catch (err) {
    res.status(500).send(err);
  }
});

XrpRoutes.get('/api/XRP/:network/reserve', async (req, res) => {
  let { network } = req.params;
  try {
    const reserve = await XRP.getReserve(network);
    res.json({ reserve });
  } catch (err) {
    res.status(500).send(err);
  }
});
