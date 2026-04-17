import express from 'express';
import * as Types from '../../types/expressapp';
import { Errors } from '../errors/errordefinitions';
import { logger } from '../logger';
import { WalletService } from '../server';

interface RouteHelpers {
  getServer: Types.GetServerFn;
  getServerWithAuth: Types.GetServerWithAuthFn;
  getServerWithMultiAuth: Types.GetServerWithMultiAuthFn;
  logDeprecated: Types.LogDeprecatedFn;
  setPublicCache: (res: express.Response, seconds: number) => void;
}

export function createRouteHelpers(returnError: Types.ReturnErrorFn): RouteHelpers {
  const logDeprecated: Types.LogDeprecatedFn = req => {
    logger.warn('DEPRECATED', req.method, req.url, '(' + req.header('x-client-version') + ')');
  };

  const getCredentials: Types.GetCredentialsFn = req => {
    const identity = req.header('x-identity');
    if (!identity) return;

    return {
      copayerId: identity,
      signature: req.header('x-signature'),
      session: req.header('x-session')
    };
  };

  const getServer: Types.GetServerFn = (req, _res) => {
    const opts = {
      clientVersion: req.header('x-client-version'),
      userAgent: req.header('user-agent')
    };
    return WalletService.getInstance(opts);
  };

  const getServerWithAuth: Types.GetServerWithAuthFn = async (req, res, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    opts = (opts || {}) as Types.ServerOpts;

    const credentials = getCredentials(req);
    if (!credentials) {
      return returnError(Errors.NOT_AUTHORIZED, res, req);
    }

    const reqUrl = req.redirectedUrl || req.url;
    const auth = {
      copayerId: credentials.copayerId,
      message: req.method.toLowerCase() + '|' + reqUrl + '|' + JSON.stringify(req.body),
      signature: credentials.signature,
      clientVersion: req.header('x-client-version'),
      userAgent: req.header('user-agent'),
      walletId: req.header('x-wallet-id'),
      session: undefined
    };

    if (opts.allowSession) {
      auth.session = credentials.session;
    }

    try {
      const server: WalletService = await new Promise((resolve, reject) => {
        WalletService.getInstanceWithAuth(auth, (err, server) => {
          if (err) {
            return reject(err);
          }

          if (opts.onlySupportStaff && !server.copayerIsSupportStaff) {
            return reject(Errors.NOT_AUTHORIZED);
          }

          if (server.copayerIsSupportStaff) {
            req.isSupportStaff = true;
          }

          if (opts.onlyMarketingStaff && !server.copayerIsMarketingStaff) {
            return reject(Errors.NOT_AUTHORIZED);
          }

          req.walletId = server.walletId;
          req.copayerId = server.copayerId;

          return resolve(server);
        });
      });

      if (cb) {
        return cb(server);
      }
      return server;
    } catch (err) {
      if (opts.silentFailure) {
        if (cb) {
          return cb(null, err);
        }
        throw err;
      }
      return returnError(err, res, req);
    }
  };

  const getServerWithMultiAuth: Types.GetServerWithMultiAuthFn = (req, res, opts = {}) => {
    const identities = req.headers['x-identities'] ? req.headers['x-identities'].split(',') : false;
    const signature = req.headers['x-signature'];
    if (!identities || !signature) {
      throw Errors.NOT_AUTHORIZED;
    }

    if (!Array.isArray(identities)) {
      throw Errors.NOT_AUTHORIZED;
    }

    return identities.map(
      id =>
        new Promise((resolve, reject) =>
          getServerWithAuth(
            Object.assign(req, {
              headers: {
                ...req.headers,
                'x-identity': id
              }
            }),
            res,
            opts,
            (server, err) => (err ? reject(err) : resolve(server))
          )
        )
    );
  };

  const setPublicCache = (res: express.Response, seconds: number) => {
    res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-if-error=${10 * seconds}`);
  };

  return {
    getServer,
    getServerWithAuth,
    getServerWithMultiAuth,
    logDeprecated,
    setPublicCache
  };
}
