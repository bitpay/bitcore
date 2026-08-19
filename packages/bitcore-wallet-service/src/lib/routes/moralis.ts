import cors from 'cors';
import express from 'express';
import config from '../../config';
import type * as Types from '../../types/expressapp';
import type { WalletService } from '../server';

interface RouteContext {
  getServer: Types.GetServerFn;
  getServerWithAuth: Types.GetServerWithAuthFn;
  returnError: Types.ReturnErrorFn;
}

type RouteHandler = (server: WalletService) => Promise<any>;

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

  handler(server)
    .then(response => {
      res.json(response);
    })
    .catch(err => {
      context.returnError(err ?? 'unknown', res, req);
    });
}

function walletAuthOrPublic(context: RouteContext) {
  return function(req, res, next) {
    if (!req.header('x-identity')) {
      // Not from wallet
      return next();
    }
    return context.getServerWithAuth(req, res, _server => {
      if (!req.header('origin')) {
        req.headers['origin'] = config.moralis?.whitelist?.[0];
      }
      return next();
    });
  };
}

export function registerMoralisRoutes(router: express.Router, context: RouteContext) {
  const moralisCorsOptions = {
    origin: (origin, cb) => {
      const moralisWhiteList = config.moralis?.whitelist ?? [];
      if (moralisWhiteList.indexOf(origin) !== -1) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    }
  };

  router.post('/v1/moralis/getWalletTokenBalances', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetWalletTokenBalances(req);
    });
  });

  router.post('/v1/moralis/moralisGetTokenAllowance', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetTokenAllowance(req);
    });
  });

  router.post('/v1/moralis/moralisGetNativeBalance', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetNativeBalance(req);
    });
  });

  router.post('/v1/moralis/GetTokenPrice', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetTokenPrice(req);
    });
  });

  router.post('/v1/moralis/getMultipleERC20TokenPrices', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetMultipleERC20TokenPrices(req);
    });
  });

  router.post('/v1/moralis/getERC20TokenBalancesWithPricesByWallet', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetERC20TokenBalancesWithPricesByWallet(req);
    });
  });

  router.post('/v1/moralis/getSolWalletPortfolio', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetSolWalletPortfolio(req);
    });
  });

  router.post('/v1/moralis/getTransactionVerbose', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetTransactionVerbose(req);
    });
  });

  router.post('/v1/moralis/getMultipleSolTokenPrices', walletAuthOrPublic(context), cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetMultipleSolTokenPrices(req);
    });
  });
}
