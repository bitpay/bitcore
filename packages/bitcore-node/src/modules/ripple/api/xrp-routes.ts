import { Router } from 'express';
import { XRP } from './csp';
import { Auth, AuthenticatedRequest } from '../../../utils/auth';
export const XrpRoutes = Router();

XrpRoutes.get('/api/XRP/:network/address/:address/txs/count', async (req, res) => {
  let { address, network } = req.params;
  try {
    const nonce = await XRP.getAccountNonce(network, address);
    res.json({ nonce });
  } catch (err) {
    res.status(500).send(err);
  }
});

XrpRoutes.get('/api/:chain/:network/wallet/:pubKey/balanceAtBlock/:block', Auth.authenticateMiddleware, async (req: AuthenticatedRequest, res) => {
  let { network, block } = req.params;
  try {
    const result = await XRP.getWalletBalanceAtBlock({
      chain: 'XRP',
      network,
      wallet: req.wallet!,
      block,
      args: req.query
    });
    return res.send(result || { confirmed: 0, unconfirmed: 0, balance: 0 });
  } catch (err) {
    return res.status(500).json(err);
  }
});
