import { Router } from 'express';
import logger from '../../../logger';
import { ETH } from './csp';
export const EthRoutes = Router();

EthRoutes.get('/api/ETH/:network/address/:address/txs/count', async (req, res) => {
  let { address, network } = req.params;
  try {
    const nonce = await ETH.getAccountNonce(network, address);
    res.json({ nonce });
  } catch (err) {
    logger.error('Nonce Error::' + err);
    res.status(500).send(err);
  }
});

EthRoutes.post('/api/ETH/:network/gas', async (req, res) => {
  const { from, to, value, data, gasPrice } = req.body;
  const { network } = req.params;
  try {
    const gasLimit = await ETH.estimateGas({ network, from, to, value, data, gasPrice });
    res.json(gasLimit);
  } catch (err) {
    res.status(500).send(err);
  }
});

EthRoutes.get('/api/ETH/:network/token/:tokenAddress', async (req, res) => {
  const { network, tokenAddress } = req.params;
  try {
    const tokenInfo = await ETH.getERC20TokenInfo(network, tokenAddress);
    res.json(tokenInfo);
  } catch (err) {
    res.status(500).send(err);
  }
});
