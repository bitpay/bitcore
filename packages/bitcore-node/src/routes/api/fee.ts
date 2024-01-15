import { Request, Response } from 'express';
import config from '../../config';
import logger from '../../logger';
import { ChainStateProvider } from '../../providers/chain-state';
import { IUtxoNetworkConfig } from '../../types/Config';
import { CacheTimes } from '../middleware';
import { CacheMiddleware } from '../middleware';
const router = require('express').Router({ mergeParams: true });
const feeCache = {};

const feeModes = {
  BTC: ['CONSERVATIVE', 'ECONOMICAL'],
  LTC: ['CONSERVATIVE', 'ECONOMICAL']
};

router.get('/:target', CacheMiddleware(CacheTimes.Second), async (req: Request, res: Response) => {
  let { target, chain, network } = req.params;
  let { mode, txType } = req.query;
  if (!chain || !network) {
    return res.status(400).send('Missing required param');
  }

  chain = chain.toUpperCase();
  network = network.toLowerCase();
  mode = mode?.toUpperCase();
  const targetNum = Number(target);
  if (targetNum < 0 || targetNum > 100) {
    return res.status(400).send('invalid target specified');
  }
  if (!mode) {
    mode = (config.chains[chain]?.[network] as IUtxoNetworkConfig)?.defaultFeeMode;
  } else if (!feeModes[chain]) {
    mode = undefined;
  } else if (!feeModes[chain]?.includes(mode)) {
    return res.status(400).send('invalid mode specified');
  }
  if (txType && txType.toString() != '2') {
    return res.status(400).send('invalid txType specified');
  }
  let feeCacheKey = `${chain}:${network}:${target}`;
  feeCacheKey += `${mode ? ':' + mode : ''}`;
  feeCacheKey += `${txType ? ':type' + txType : ''}`;
  const cachedFee = feeCache[feeCacheKey];
  if (cachedFee && cachedFee.date > Date.now() - 10 * 1000) {
    return res.json(cachedFee.fee);
  }
  try {
    let fee = await ChainStateProvider.getFee({ chain, network, target: targetNum, mode, txType });
    if (!fee) {
      return res.status(404).send('not available right now');
    }
    // As of v0.21.2.2, Litecoin Core has a bug where it returns a fee rate of 0.00000999 which is below the min relay fee (0.00001).
    // TODO: remove this if statement once https://github.com/litecoin-project/litecoin/issues/908 is fixed.
    if (chain === 'LTC' && fee.feerate && fee.feerate < 0.00001) {
      fee.feerate = 0.00001;
    }
    feeCache[feeCacheKey] = { fee, date: Date.now() };
    return res.json(fee);
  } catch (err: any) {
    logger.error('Fee Error: %o', err.message || err);
    return res.status(500).send('Error getting fee from RPC');
  }
});

module.exports = {
  router,
  path: '/fee'
};
