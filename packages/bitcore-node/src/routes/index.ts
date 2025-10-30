import cors from 'cors';
import express from 'express';
import config from '../config';
import { Config } from '../services/config';
import * as apiRoutes from './api';
import { CacheMiddleware, CacheTimes, LogMiddleware, RateLimiter } from './middleware';
import { statusRoute } from './status';
import { Web3Proxy } from './web3';
import type { Request, Response } from 'express';

const app = express();

const bodyLimit = 100 * 1024 * 1024; // 100 MB
app.use(
  express.json({
    limit: bodyLimit
  })
);
app.use(
  express.raw({
    limit: bodyLimit
  })
);
const chains = Config.chains();
const networks: any = {};
for (const chain of chains) {
  for (const network of Object.keys(config.chains[chain])) {
    networks[chain] = networks[chain] || {};
    Object.assign(networks[chain], {
      [network]: true
    });
  }
}

function bootstrapApiRoutes() {
  const router = express.Router({
    mergeParams: true
  });
  for (const route of Object.values<{ path: string; router: express.Router }>(apiRoutes)) {
    router.use(route.path, route.router);
  }

  return router;
}

app.use(cors());
app.use(LogMiddleware());
app.use(CacheMiddleware(CacheTimes.Second, CacheTimes.Second));
app.use(RateLimiter('GLOBAL', 10, 200, 4000));
app.use('/api' + statusRoute.path, statusRoute.router);
// Change aliased chain and network params
app.param(['chain', 'network'], (req: Request, _: Response, next: any) => {
  const { chain: beforeChain, network: beforeNetwork } = req.params;
  const { chain, network } = Config.aliasFor({ chain: beforeChain, network: beforeNetwork });
  req.params.chain = chain;
  req.params.network = network;
  next();
});
app.use('/api/:chain/:network', (req: Request, resp: Response, next: any) => {
  const { chain, network } = req.params;

  const hasChain = chains.includes(chain as string);
  const chainNetworks = networks[chain as string] || null;
  const hasChainNetworks = chainNetworks != null;
  const hasNetworkForChain = hasChainNetworks ? chainNetworks[network as string] : false;

  if (chain && !hasChain) {
    return resp.status(500).send(`This node is not configured for the chain ${chain}`);
  }
  if (network && (!hasChainNetworks || !hasNetworkForChain)) {
    return resp.status(500).send(`This node is not configured for the network ${network} on chain ${chain}`);
  }
  return next();
});

app.use('/api/:chain/:network', bootstrapApiRoutes());
app.use('/web3/:chain/:network', Web3Proxy);

export default app;
