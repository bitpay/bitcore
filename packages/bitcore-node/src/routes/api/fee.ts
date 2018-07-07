import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
const router = require('express').Router({ mergeParams: true });

router.get('/:target', async (req: Request, res: Response) => {
  let { target, chain, network } = req.params;
  if (network === 'regtest') {
    return res.json({ feerate: 0.0002 }); // default 20 sat/byte for regtest
  }
  try {
    let fee = await ChainStateProvider.getFee({ chain, network, target});
    if (!fee) {
      return res.status(404).send('not available right now');
    }
    return res.json(fee);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/fee'
};
