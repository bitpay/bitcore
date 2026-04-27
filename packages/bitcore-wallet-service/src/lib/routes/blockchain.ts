import express from 'express';
import * as _ from 'lodash';
import type * as Types from '../../types/expressapp';
import type { WalletService } from '../server';

interface RouteContext {
  estimateFeeLimiter: express.Handler;
  getServer: Types.GetServerFn;
  getServerWithAuth: Types.GetServerWithAuthFn;
  logDeprecated: Types.LogDeprecatedFn;
  setPublicCache: (res: express.Response, seconds: number) => void;
  returnError: Types.ReturnErrorFn;
}

type RouteHandler = (server: WalletService) => Promise<any> | any;

const ONE_MINUTE = 60;

function callbackResult<T>(fn: (cb: (err?: any, data?: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, data) => {
      if (err) return reject(err);
      return resolve(data as T);
    });
  });
}

function getServerOrReturnError(req, res, context: RouteContext): WalletService | null {
  try {
    return context.getServer(req, res);
  } catch (err) {
    context.returnError(err, res, req);
    return null;
  }
}

function respondWithPublicServer(req, res, context: RouteContext, handler: RouteHandler) {
  const server = getServerOrReturnError(req, res, context);
  if (!server) return;

  Promise.resolve()
    .then(() => handler(server))
    .then(response => {
      res.json(response);
    })
    .catch(err => {
      context.returnError(err ?? 'unknown', res, req);
    });
}

function respondWithAuthServer(req, res, context: RouteContext, handler: RouteHandler) {
  context.getServerWithAuth(req, res, server => {
    Promise.resolve()
      .then(() => handler(server))
      .then(response => {
        res.json(response);
      })
      .catch(err => {
        context.returnError(err ?? 'unknown', res, req);
      });
  });
}

export function registerBlockchainRoutes(router: express.Router, context: RouteContext) {
  const { estimateFeeLimiter, logDeprecated, setPublicCache } = context;

  router.get('/v1/feelevels/', estimateFeeLimiter, (req, res) => {
    setPublicCache(res, 1 * ONE_MINUTE);
    logDeprecated(req);

    respondWithPublicServer(req, res, context, server =>
      callbackResult(resolve => {
        const opts: { network?: string } = {};
        if (req.query.network) opts.network = req.query.network as string;
        server.getFeeLevels(opts, resolve);
      }).then((feeLevels: any[]) => {
        _.each(feeLevels, feeLevel => {
          feeLevel.feePerKB = feeLevel.feePerKb;
          delete feeLevel.feePerKb;
        });
        return feeLevels;
      })
    );
  });

  router.get('/v2/feelevels/', (req, res) => {
    setPublicCache(res, 1 * ONE_MINUTE);

    respondWithPublicServer(req, res, context, server =>
      callbackResult(resolve => {
        const opts: { coin?: string; network?: string; chain?: string } = {};
        if (req.query.coin) opts.coin = req.query.coin as string;
        if (req.query.chain || req.query.coin) opts.chain = (req.query.chain || req.query.coin) as string;
        if (req.query.network) opts.network = req.query.network as string;
        server.getFeeLevels(opts, resolve);
      })
    );
  });

  router.post('/v3/estimateGas/', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.estimateGas(req.body);
    });
  });

  router.post('/v1/ethmultisig/', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.getMultisigContractInstantiationInfo(req.body);
    });
  });

  router.post('/v1/ethmultisig/info', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.getMultisigContractInfo(req.body);
    });
  });

  router.post('/v1/multisig/', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.getMultisigContractInstantiationInfo(req.body);
    });
  });

  router.post('/v1/multisig/info', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.getMultisigContractInfo(req.body);
    });
  });

  router.post('/v1/token/info', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.getTokenContractInfo(req.body);
    });
  });

  router.post('/v1/token/allowance', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.getTokenAllowance(req.body);
    });
  });

  router.get('/v1/nonce/:address', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.getNonce({
        coin: req.query.coin || 'eth',
        chain: req.query.chain,
        network: req.query.network || 'livenet',
        address: req.params['address']
      });
    });
  });
}
