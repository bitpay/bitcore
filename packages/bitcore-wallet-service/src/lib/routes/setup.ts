import compression from 'compression';
import express from 'express';
import RateLimit from 'express-rate-limit';
import config from '../../config';
import { Common } from '../common';
import { logger, transports } from '../logger';
import { WalletService } from '../server';
import { LogMiddleware } from './middleware/log';

const Defaults = Common.Defaults;

export function setupAppMiddleware(app: express.Express, opts) {
  app.use(compression());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'x-signature,x-identity,x-identities,x-session,x-client-version,x-wallet-id,X-Requested-With,Content-Type,Authorization'
    );
    res.setHeader('x-service-version', WalletService.getServiceVersion());
    next();
  });

  app.use((req, res, next) => {
    if ('OPTIONS' == req.method) {
      res.sendStatus(200);
      res.end();
      return;
    }
    next();
  });

  app.enable('trust proxy');

  app.use((req, res, next) => {
    req.on('abort', () => {
      logger.warn('Request aborted by the client');
    });
    next();
  });

  const POST_LIMIT = 1024 * 100;
  const POST_LIMIT_LARGE = 2 * 1024 * 1024;

  app.use((req, res, next) => {
    if (req.path.includes('/txproposals') || req.path.includes('/tss/')) {
      return express.json({ limit: POST_LIMIT_LARGE })(req, res, next);
    } else {
      return express.json({ limit: POST_LIMIT })(req, res, next);
    }
  });

  app.use((req, res, next) => {
    if (config.maintenanceOpts.maintenanceMode === true) {
      const errorCode = 503;
      const errorMessage = 'BWS down for maintenance';
      res.status(503).send({ code: errorCode, message: errorMessage });
    } else {
      next();
    }
  });

  if (opts.disableLogs) {
    for (const transport of transports) {
      transport.level = 'error';
    }
  } else {
    app.use(LogMiddleware());
  }
}

export function createEstimateFeeLimiter(opts) {
  if (Defaults.RateLimit.estimateFee && !opts.ignoreRateLimiter) {
    logger.info(
      'Limiting estimate fee per IP: %o req/h',
      ((Defaults.RateLimit.estimateFee.max / Defaults.RateLimit.estimateFee.windowMs) * 60 * 60 * 1000).toFixed(2)
    );
    return new RateLimit(Defaults.RateLimit.estimateFee);
  }

  return (req, res, next) => {
    next();
  };
}
