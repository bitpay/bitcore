import path from 'path';
import express from 'express';
import 'source-map-support/register';
import config from '../config';
import * as Types from '../types/expressapp';
import { registerAdvertisementRoutes } from './expressapp/advertisements';
import { registerBlockchainRoutes } from './expressapp/blockchain';
import { createRouteHelpers } from './expressapp/context';
import { registerMaintenanceRoutes } from './expressapp/maintenance';
import { registerMoralisRoutes } from './expressapp/moralis';
import { registerNotificationRoutes } from './expressapp/notifications';
import { registerServiceRoutes } from './expressapp/services';
import { createEstimateFeeLimiter, setupAppMiddleware } from './expressapp/setup';
import { registerTransactionRoutes } from './expressapp/transactions';
import { registerWalletDataRoutes } from './expressapp/wallet-data';
import { registerWalletRoutes } from './expressapp/wallets';
import { logger } from './logger';
import { AaveRouter } from './routes/aave';
import { error } from './routes/helpers';
import { createWalletLimiter } from './routes/middleware/createWalletLimiter';
import { TssRouter } from './routes/tss';
import { WalletService } from './server';

export class ExpressApp {
  app: express.Express;

  constructor() {
    this.app = express();
  }
  /**
   * start
   *
   * @param opts.WalletService options for WalletService class
   * @param opts.basePath
   * @param opts.disableLogs
   * @param opts.doNotCheckV8
   * @param {Callback} cb
   */
  start(opts, cb) {
    opts = opts || {};
    setupAppMiddleware(this.app, opts);

    const router = express.Router();

    error.setOpts(opts);
    const returnError: Types.ReturnErrorFn = error.returnError.bind(error);
    const {
      getServer,
      getServerWithAuth,
      getServerWithMultiAuth,
      logDeprecated,
      setPublicCache
    } = createRouteHelpers(returnError);

    registerWalletRoutes(router, {
      createWalletLimiter: createWalletLimiter(opts),
      getServer,
      getServerWithAuth,
      getServerWithMultiAuth,
      logDeprecated,
      returnError
    });

    registerTransactionRoutes(router, {
      getServerWithAuth,
      returnError
    });

    registerAdvertisementRoutes(router, {
      getServer,
      getServerWithAuth,
      setPublicCache,
      returnError
    });

    /* THIS WAS NEVED ENABLED YET NOW 2020-04-07
    router.post('/v4/txproposals/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txpVersion = 4;
        server.createTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
        });
      });
    });

*/
    const estimateFeeLimiter = createEstimateFeeLimiter(opts);

    registerBlockchainRoutes(router, {
      estimateFeeLimiter,
      getServer,
      getServerWithAuth,
      logDeprecated,
      setPublicCache,
      returnError
    });

    registerWalletDataRoutes(router, {
      getServerWithAuth,
      logDeprecated,
      returnError
    });

    registerNotificationRoutes(router, {
      getServerWithAuth,
      logDeprecated,
      returnError
    });

    registerMaintenanceRoutes(router, {
      getServerWithAuth,
      setPublicCache,
      returnError
    });

    registerServiceRoutes(router, {
      getServer,
      getServerWithAuth,
      setPublicCache,
      returnError
    });

    registerMoralisRoutes(router, {
      getServer,
      returnError
    });

    /** Imported routes */
    router.use(new AaveRouter({ returnError, getServer }).router);
    router.use(new TssRouter({ returnError, opts }).router);

    // Set no-cache by default
    this.app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    });

    const staticPath = path.join(__dirname, '../../../static');
    this.app.use('/bws/static', express.static(staticPath));

    this.app.use(opts.basePath || '/bws/api', router);

    if (config.staticRoot) {
      logger.debug(`Serving static files from ${config.staticRoot}`);
      this.app.use('/static', express.static(config.staticRoot));
    }

    WalletService.initialize(opts, cb);
  }
}
