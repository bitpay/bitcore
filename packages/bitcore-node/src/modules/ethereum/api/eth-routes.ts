import { Router } from 'express';
import { EthTransactionStorage } from '../models/transaction';
import { ETHStateProvider } from './csp';
export const EthRoutes = Router();

EthRoutes.get('/api/ETH/:network/address/:address/txs/count', async (req, res) => {
  let { address, network } = req.params;
  try {
    const nonce = await EthTransactionStorage.collection.countDocuments({ chain: 'ETH', network, from: address });
    res.json({ nonce });
  } catch (err) {
    res.status(500).send(err);
  }
});

EthRoutes.post('/api/ETH/:network/fee/gas', async (req, res) => {
  const { from, to, value, data, gasPrice } = req.body;
  const { network } = req.params;
  try {
    const gasLimit = await new ETHStateProvider().estimateGas({ network, from, to, value, data, gasPrice });
    res.json(gasLimit);
  } catch (err) {
    res.status(500).send(err);
  }
});

EthRoutes.get('/api/ETH/:network/token/:tokenAddress', async (req, res) => {
  const { network, tokenAddress } = req.params;
  try {
    const provider = new ETHStateProvider();
    const token = provider.erc20For(network, tokenAddress);
    const [name, decimals, symbol] = await Promise.all([
      token.methods.name().call(),
      token.methods.decimals().call(),
      token.methods.symbol().call()
    ]);
    res.json({ name, decimals, symbol, tokenAddress });
  } catch (err) {
    res.status(500).send(err);
  }
});
