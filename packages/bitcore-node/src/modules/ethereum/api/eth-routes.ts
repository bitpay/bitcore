import { Router } from 'express';
import { EthTransactionStorage } from '../models/transaction';
export const EthRoutes = Router();

EthRoutes.get('/api/ETH/:network/address/:address/txs/count', async function(req, res) {
  let { address, network } = req.params;
  const nonce = await EthTransactionStorage.collection.countDocuments({ chain: 'ETH', network, from: address });
  res.json({ nonce });
});
