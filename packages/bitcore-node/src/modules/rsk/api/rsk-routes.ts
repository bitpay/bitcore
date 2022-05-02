import { Router } from 'express';
import logger from '../../../logger';
import { RSK } from './csp';
import { Gnosis } from './gnosis';
export const RskRoutes = Router();

RskRoutes.get('/api/RSK/:network/address/:address/txs/count', async (req, res) => {
  let { address, network } = req.params;
  try {
    const nonce = await RSK.getAccountNonce(network, address);
    res.json({ nonce });
  } catch (err) {
    logger.error('Nonce Error::' + err);
    res.status(500).send(err);
  }
});

RskRoutes.post('/api/RSK/:network/gas', async (req, res) => {
  const { from, to, value, data, gasPrice } = req.body;
  const { network } = req.params;
  try {
    const gasLimit = await RSK.estimateGas({ network, from, to, value, data, gasPrice });
    res.json(gasLimit);
  } catch (err) {
    res.status(500).send(err);
  }
});

RskRoutes.get('/api/RSK/:network/token/:tokenAddress', async (req, res) => {
  const { network, tokenAddress } = req.params;
  try {
    const tokenInfo = await RSK.getERC20TokenInfo(network, tokenAddress);
    res.json(tokenInfo);
  } catch (err) {
    res.status(500).send(err);
  }
});

RskRoutes.get('/api/RSK/:network/ethmultisig/info/:multisigContractAddress', async (req, res) => {
  const { network, multisigContractAddress } = req.params;
  try {
    const multisigInfo = await Gnosis.getMultisigEthInfo(network, multisigContractAddress);
    res.json(multisigInfo);
  } catch (err) {
    res.status(500).send(err);
  }
});

RskRoutes.get('/api/RSK/:network/ethmultisig/:sender/instantiation/:txId', async (req, res) => {
  const { network, sender, txId } = req.params;
  try {
    const multisigInstantiationInfo = await Gnosis.getMultisigContractInstantiationInfo(network, sender, txId);
    res.json(multisigInstantiationInfo);
  } catch (err) {
    res.status(500).send(err);
  }
});

RskRoutes.get('/api/RSK/:network/ethmultisig/txps/:multisigContractAddress', async (req, res) => {
  const { network, multisigContractAddress } = req.params;
  try {
    const multisigTxpsInfo = await Gnosis.getMultisigTxpsInfo(network, multisigContractAddress);
    res.json(multisigTxpsInfo);
  } catch (err) {
    res.status(500).send(err);
  }
});

RskRoutes.get('/api/RSK/:network/ethmultisig/transactions/:multisigContractAddress', async (req, res) => {
  let { network, multisigContractAddress } = req.params;
  const chain = 'RSK';
  try {
    return await Gnosis.streamGnosisWalletTransactions({
      chain,
      network,
      multisigContractAddress,
      wallet: {} as any,
      req,
      res,
      args: req.query
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});
