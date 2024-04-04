import { Router } from 'express';
import { ChainStateProvider } from '../../';
import logger from '../../../../logger';
import { BaseEVMStateProvider } from './csp';
import { Gnosis } from './gnosis';
export const EVMRoutes = Router();

function getCSP(chain: string) {
  return ChainStateProvider.get({ chain }) as BaseEVMStateProvider;
}

EVMRoutes.get('/api/:chain/:network/address/:address/txs/count', async (req, res) => {
  const { chain, network, address } = req.params;
  try {
    const nonce = await getCSP(chain).getAccountNonce(network, address);
    res.json({ nonce });
  } catch (err) {
    logger.error('Nonce Error::%o', err);
    res.status(500).send(err);
  }
});

EVMRoutes.post('/api/:chain/:network/gas', async (req, res) => {
  const { from, to, value, data, gasPrice } = req.body;
  let { chain, network } = req.params;
  try {
    const gasLimit = await getCSP(chain).estimateGas({ network, from, to, value, data, gasPrice });
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

EVMRoutes.get('/api/:chain/:network/token/:tokenAddress', async (req, res) => {
  const { chain, network, tokenAddress } = req.params;
  try {
    const tokenInfo = await getCSP(chain).getERC20TokenInfo(network, tokenAddress);
    res.json(tokenInfo);
  } catch (err) {
    logger.error('Token Info Error::%o', err);
    res.status(500).send(err);
  }
});

EVMRoutes.get('/api/:chain/:network/token/:tokenAddress/allowance/:ownerAddress/for/:spenderAddress', async (req, res) => {
  const { chain, network, tokenAddress, ownerAddress, spenderAddress } = req.params;
  try {
    const allowance = await getCSP(chain).getERC20TokenAllowance(network, tokenAddress, ownerAddress, spenderAddress);
    res.json(allowance);
  } catch (err) {
    logger.error('Token Allowance Error::%o', err);
    res.status(500).send(err);
  }
});

EVMRoutes.get('/api/:chain/:network/ethmultisig/info/:multisigContractAddress', async (req, res) => {
  const { chain, network, multisigContractAddress } = req.params;
  try {
    const multisigInfo = await Gnosis.getMultisigInfo(chain, network, multisigContractAddress);
    res.json(multisigInfo);
  } catch (err) {
    logger.error('Multisig Info Error::%o', err);
    res.status(500).send(err);
  }
});

EVMRoutes.get('/api/:chain/:network/ethmultisig/:sender/instantiation/:txId', async (req, res) => {
  const { chain, network, sender, txId } = req.params;
  try {
    const multisigInstantiationInfo = await Gnosis.getMultisigContractInstantiationInfo(chain, network, sender, txId);
    res.json(multisigInstantiationInfo);
  } catch (err) {
    logger.error('Multisig Instantiation Error::%o', err);
    res.status(500).send(err);
  }
});

EVMRoutes.get('/api/:chain/:network/ethmultisig/txps/:multisigContractAddress', async (req, res) => {
  const { chain, network, multisigContractAddress } = req.params;
  try {
    const multisigTxpsInfo = await Gnosis.getMultisigTxpsInfo(chain, network, multisigContractAddress);
    res.json(multisigTxpsInfo);
  } catch (err) {
    logger.error('Multisig Txps Error::%o', err);
    res.status(500).send(err);
  }
});

EVMRoutes.get('/api/:chain/:network/ethmultisig/transactions/:multisigContractAddress', async (req, res) => {
  const { chain, network, multisigContractAddress } = req.params;

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
    logger.error('Multisig Transactions Error::%o', err);
    return res.status(500).send(err);
  }
});

EVMRoutes.get('/api/:chain/:network/priorityFee/:percentile', async (req, res) => {
  let { chain, network, percentile } = req.params;
  const priorityFeePercentile = Number(percentile) || 15;

  network = (network).toLowerCase();
  try {
    let fee = await getCSP(chain).getPriorityFee({ network, percentile: priorityFeePercentile });
    if (!fee) {
      return res.status(404).send('not available right now');
    }
    return res.json(fee);
  } catch (err: any) {
    logger.error('Fee Error: %o', err.message || err);
    return res.status(500).send('Error getting priority fee from RPC');
  }
});
