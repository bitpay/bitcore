import { Router } from 'express';
import logger from '../../../logger';
import { AliasDataRequest } from '../../../routes/middleware';
import { ETH } from './csp';
import { Gnosis } from './gnosis';
export const EthRoutes = Router();

EthRoutes.get('/api/:chain/:network/address/:address/txs/count', async (req, res) => {
  let { network } = req as AliasDataRequest;
  let { address } = req.params;
  try {
    const nonce = await ETH.getAccountNonce(network as string, address);
    res.json({ nonce });
  } catch (err) {
    logger.error('Nonce Error::%o', err);
    res.status(500).send(err);
  }
});

EthRoutes.post('/api/:chain/:network/gas', async (req, res) => {
  const { from, to, value, data, gasPrice } = req.body;
  let { network } = req as AliasDataRequest;
  try {
    const gasLimit = await ETH.estimateGas({ network, from, to, value, data, gasPrice });
    res.json(gasLimit);
  } catch (err: any) {
    if (err?.code != null) { // Preventable error from geth (probably due to insufficient funds or similar)
      res.status(400).send(err.message);
    } else {
      logger.error('Gas Error::%o', err);
      res.status(500).send(err);
    }
  }
});

EthRoutes.get('/api/:chain/:network/token/:tokenAddress', async (req, res) => {
  let { network } = req as AliasDataRequest;
  const { tokenAddress } = req.params;
  try {
    const tokenInfo = await ETH.getERC20TokenInfo(network as string, tokenAddress);
    res.json(tokenInfo);
  } catch (err) {
    logger.error('Token Info Error::%o', err);
    res.status(500).send(err);
  }
});

EthRoutes.get('/api/:chain/:network/token/:tokenAddress/allowance/:ownerAddress/for/:spenderAddress', async (req, res) => {
  let { network } = req as AliasDataRequest;
  const { tokenAddress, ownerAddress, spenderAddress } = req.params;
  try {
    const allowance = await ETH.getERC20TokenAllowance(network as string, tokenAddress, ownerAddress, spenderAddress);
    res.json(allowance);
  } catch (err) {
    logger.error('Token Allowance Error::%o', err);
    res.status(500).send(err);
  }
});

EthRoutes.get('/api/:chain/:network/ethmultisig/info/:multisigContractAddress', async (req, res) => {
  let { network } = req as AliasDataRequest;
  const { multisigContractAddress } = req.params;
  try {
    const multisigInfo = await Gnosis.getMultisigEthInfo(network as string, multisigContractAddress);
    res.json(multisigInfo);
  } catch (err) {
    logger.error('Multisig Info Error::%o', err);
    res.status(500).send(err);
  }
});

EthRoutes.get('/api/:chain/:network/ethmultisig/:sender/instantiation/:txId', async (req, res) => {
  let { network } = req as AliasDataRequest;
  const { sender, txId } = req.params;
  try {
    const multisigInstantiationInfo = await Gnosis.getMultisigContractInstantiationInfo(network as string, sender, txId);
    res.json(multisigInstantiationInfo);
  } catch (err) {
    logger.error('Multisig Instantiation Error::%o', err);
    res.status(500).send(err);
  }
});

EthRoutes.get('/api/:chain/:network/ethmultisig/txps/:multisigContractAddress', async (req, res) => {
  let { network } = req as AliasDataRequest;
  const { multisigContractAddress } = req.params;
  try {
    const multisigTxpsInfo = await Gnosis.getMultisigTxpsInfo(network as string, multisigContractAddress);
    res.json(multisigTxpsInfo);
  } catch (err) {
    logger.error('Multisig Txps Error::%o', err);
    res.status(500).send(err);
  }
});

EthRoutes.get('/api/:chain/:network/ethmultisig/transactions/:multisigContractAddress', async (req, res) => {
  let { chain, network } = req as AliasDataRequest;
  let { multisigContractAddress } = req.params;

  try {
    return await Gnosis.streamGnosisWalletTransactions({
      chain: chain as string,
      network: network as string,
      multisigContractAddress,
      wallet: {} as any,
      req,
      res,
      args: req.query
    });
  } catch (err) {
    logger.error('Multisig Transactions Error::%o', err);
    return res.status(500).send(err);
  }
});

EthRoutes.get('/api/:chain/:network/priorityFee/:percentile', async (req, res) => {
  let { network } = req as AliasDataRequest;
  let { percentile } = req.params;
  const priorityFeePercentile = Number(percentile) || 15;

  network = (network as string).toLowerCase();
  try {
    let fee = await ETH.getPriorityFee({ network, percentile: priorityFeePercentile });
    if (!fee) {
      return res.status(404).send('not available right now');
    }
    return res.json(fee);
  } catch (err: any) {
    logger.error('Fee Error: %o', err.message || err);
    return res.status(500).send('Error getting priority fee from RPC');
  }
});
