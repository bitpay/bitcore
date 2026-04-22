import cors from 'cors';
import express from 'express';
import config from '../../config';
import type * as Types from '../../types/expressapp';
import type { WalletService } from '../server';

interface RouteContext {
  getServer: Types.GetServerFn;
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

  router.post('/v1/moralis/getWalletTokenBalances', cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetWalletTokenBalances(req);
    });
  });

  router.post('/v1/moralis/moralisGetTokenAllowance', cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetTokenAllowance(req);
    });
  });

  router.post('/v1/moralis/moralisGetNativeBalance', cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetNativeBalance(req);
    });
  });

  router.post('/v1/moralis/GetTokenPrice', cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetTokenPrice(req);
    });
  });

  router.post('/v1/moralis/getMultipleERC20TokenPrices', cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetMultipleERC20TokenPrices(req);
    });
  });

  router.post('/v1/moralis/getERC20TokenBalancesWithPricesByWallet', cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetERC20TokenBalancesWithPricesByWallet(req);
    });
  });

  router.post('/v1/moralis/getSolWalletPortfolio', cors(moralisCorsOptions), (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.moralisGetSolWalletPortfolio(req);
    });
  });
}
