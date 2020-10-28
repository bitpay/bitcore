import express from 'express';
import _ from 'lodash';
import 'source-map-support/register';
import { logger, transport } from './logger';

import { ClientError } from './errors/clienterror';
import { LogMiddleware } from './middleware';
import { WalletService } from './server';
import { Stats } from './stats';

const bodyParser = require('body-parser');
const compression = require('compression');
const config = require('../config');
const RateLimit = require('express-rate-limit');
const Common = require('./common');
const rp = require('request-promise-native');
const Defaults = Common.Defaults;

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

    this.app.use(compression());

    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'x-signature,x-identity,x-session,x-client-version,x-wallet-id,X-Requested-With,Content-Type,Authorization'
      );
      res.setHeader('x-service-version', WalletService.getServiceVersion());
      next();
    });
    const allowCORS = (req, res, next) => {
      if ('OPTIONS' == req.method) {
        res.sendStatus(200);
        res.end();
        return;
      }
      next();
    };
    this.app.use(allowCORS);
    this.app.enable('trust proxy');

    // handle `abort` https://nodejs.org/api/http.html#http_event_abort
    this.app.use((req, res, next) => {
      req.on('abort', () => {
        logger.warn('Request aborted by the client');
      });
      next();
    });

    const POST_LIMIT = 1024 * 100 /* Max POST 100 kb */;

    this.app.use(
      bodyParser.json({
        limit: POST_LIMIT
      })
    );

    this.app.use((req, res, next) => {
      if (config.maintenanceOpts.maintenanceMode === true) {
        // send a 503 error, with a message to the bitpay status page
        let errorCode = 503;
        let errorMessage = 'BWS down for maintenance';
        res.status(503).send({ code: errorCode, message: errorMessage });
      } else {
        next();
      }
    });

    if (opts.disableLogs) {
      transport.level = 'error';
    } else {
      this.app.use(LogMiddleware());
      // morgan.token('walletId', function getId(req) {
      // return req.walletId ? '<' + req.walletId + '>' : '<>';
      // });

      // const logFormat =
      // ':walletId :remote-addr :date[iso] ":method :url" :status :res[content-length] :response-time ":user-agent"  ';
      // const logOpts = {
      // skip(req, res) {
      // if (res.statusCode != 200) return false;
      // return req.path.indexOf('/notifications/') >= 0;
      // },
      // stream: logger.stream
      // };

      // this.app.use(morgan(logFormat, logOpts));
    }

    const router = express.Router();

    const returnError = (err, res, req) => {
      if (err instanceof ClientError) {
        const status = err.code == 'NOT_AUTHORIZED' ? 401 : 400;
        if (!opts.disableLogs) logger.info('Client Err: ' + status + ' ' + req.url + ' ' + JSON.stringify(err));

        res
          .status(status)
          .json({
            code: err.code,
            message: err.message
          })
          .end();
      } else {
        let code = 500,
          message;
        if (err && ((err.code && _.isNumber(err.code)) || (err.statusCode && _.isNumber(err.statusCode)))) {
          code = err.code || err.statusCode;
          message = err.message || err.body;
        }

        const m = message || err.toString();

        if (!opts.disableLogs) logger.error(req.url + ' :' + code + ':' + m);

        res
          .status(code || 500)
          .json({
            error: m
          })
          .end();
      }
    };

    const logDeprecated = req => {
      logger.warn('DEPRECATED', req.method, req.url, '(' + req.header('x-client-version') + ')');
    };

    const getCredentials = req => {
      const identity = req.header('x-identity');
      if (!identity) return;

      return {
        copayerId: identity,
        signature: req.header('x-signature'),
        session: req.header('x-session')
      };
    };

    const getServer = (req, res): WalletService => {
      const opts = {
        clientVersion: req.header('x-client-version'),
        userAgent: req.header('user-agent')
      };
      return WalletService.getInstance(opts);
    };

    const getServerWithAuth = (req, res, opts, cb?: (err: any, data?: any) => void) => {
      if (_.isFunction(opts)) {
        cb = opts;
        opts = {};
      }
      opts = opts || {};

      const credentials = getCredentials(req);
      if (!credentials)
        return returnError(
          new ClientError({
            code: 'NOT_AUTHORIZED'
          }),
          res,
          req
        );

      const auth = {
        copayerId: credentials.copayerId,
        message: req.method.toLowerCase() + '|' + req.url + '|' + JSON.stringify(req.body),
        signature: credentials.signature,
        clientVersion: req.header('x-client-version'),
        userAgent: req.header('user-agent'),
        walletId: req.header('x-wallet-id'),
        session: undefined
      };
      if (opts.allowSession) {
        auth.session = credentials.session;
      }
      WalletService.getInstanceWithAuth(auth, (err, server) => {
        if (err) return returnError(err, res, req);

        if (opts.onlySupportStaff && !server.copayerIsSupportStaff) {
          return returnError(
            new ClientError({
              code: 'NOT_AUTHORIZED'
            }),
            res,
            req
          );
        }

        if (server.copayerIsSupportStaff) {
          req.isSupportStaff = true;
        }

        if (opts.onlyMarketingStaff && !server.copayerIsMarketingStaff) {
          return returnError(
            new ClientError({
              code: 'NOT_AUTHORIZED'
            }),
            res,
            req
          );
        }

        // For logging
        req.walletId = server.walletId;
        req.copayerId = server.copayerId;

        return cb(server);
      });
    };

    let createWalletLimiter;

    if (Defaults.RateLimit.createWallet && !opts.ignoreRateLimiter) {
      logger.info(
        '',
        'Limiting wallet creation per IP: %d req/h',
        ((Defaults.RateLimit.createWallet.max / Defaults.RateLimit.createWallet.windowMs) * 60 * 60 * 1000).toFixed(2)
      );
      createWalletLimiter = new RateLimit(Defaults.RateLimit.createWallet);
      // router.use(/\/v\d+\/wallets\/$/, createWalletLimiter)
    } else {
      createWalletLimiter = (req, res, next) => {
        next();
      };
    }

    const ONE_MINUTE = 60;
    // See https://support.cloudflare.com/hc/en-us/articles/115003206852-Understanding-Origin-Cache-Control
    // Case: "▶Cache an asset with revalidation, but allow stale responses if origin server is unreachable"
    function SetPublicCache(res: express.Response, seconds: number) {
      res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-if-error=${10 * seconds}`);
    }

    // retrieve latest version of copay
    router.get('/latest-version', async (req, res) => {
      SetPublicCache(res, 10 * ONE_MINUTE);
      try {
        res.setHeader('User-Agent', 'copay');
        var options = {
          uri: 'https://api.github.com/repos/bitpay/copay/releases/latest',
          headers: {
            'User-Agent': 'Copay'
          },
          json: true
        };

        let server;
        try {
          server = getServer(req, res);
        } catch (ex) {
          return returnError(ex, res, req);
        }
        server.storage.checkAndUseGlobalCache(
          'latest-copay-version',
          Defaults.COPAY_VERSION_CACHE_DURATION,
          async (err, version) => {
            if (err) {
              res.send(err);
            }
            if (version) {
              res.json({ version });
            } else {
              try {
                const htmlString = await rp(options);
                if (htmlString['tag_name']) {
                  server.storage.storeGlobalCache('latest-copay-version', htmlString['tag_name'], err => {
                    res.json({ version: htmlString['tag_name'] });
                  });
                }
              } catch (err) {
                res.send(err);
              }
            }
          }
        );
      } catch (err) {
        res.send(err);
      }
    });

    // DEPRECATED
    router.post('/v1/wallets/', createWalletLimiter, (req, res) => {
      logDeprecated(req);
      return returnError(new ClientError('BIP45 wallet creation no longer supported'), res, req);
    });

    router.post('/v2/wallets/', createWalletLimiter, (req, res) => {
      let server: WalletService;
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server.createWallet(req.body, (err, walletId) => {
        if (err) return returnError(err, res, req);
        res.json({
          walletId
        });
      });
    });

    router.put('/v1/copayers/:id/', (req, res) => {
      req.body.copayerId = req.params['id'];
      let server;
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server.addAccess(req.body, (err, result) => {
        if (err) return returnError(err, res, req);
        res.json(result);
      });
    });

    // DEPRECATED
    router.post('/v1/wallets/:id/copayers/', (req, res) => {
      logDeprecated(req);
      return returnError(new ClientError('BIP45 wallet creation no longer supported'), res, req);
    });

    router.post('/v2/wallets/:id/copayers/', (req, res) => {
      req.body.walletId = req.params['id'];
      let server;
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server.joinWallet(req.body, (err, result) => {
        if (err) return returnError(err, res, req);

        res.json(result);
      });
    });

    // DEPRECATED
    router.get('/v1/wallets/', (req, res) => {
      logDeprecated(req);
      getServerWithAuth(req, res, server => {
        server.getStatus(
          {
            includeExtendedInfo: true
          },
          (err, status) => {
            if (err) return returnError(err, res, req);
            res.json(status);
          }
        );
      });
    });

    // DEPRECATED
    router.get('/v2/wallets/', (req, res) => {
      getServerWithAuth(req, res, server => {
        const opts = { includeExtendedInfo: false, twoStep: false };
        if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;
        if (req.query.twoStep == '1') opts.twoStep = true;

        server.getStatus(opts, (err, status) => {
          if (err) return returnError(err, res, req);
          res.json(status);
        });
      });
    });

    router.get('/v3/wallets/', (req, res) => {
      getServerWithAuth(req, res, server => {
        const opts = {
          includeExtendedInfo: false,
          twoStep: false,
          includeServerMessages: false,
          tokenAddress: req.query.tokenAddress,
          multisigContractAddress: req.query.multisigContractAddress,
          network: req.query.network
        };
        if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;
        if (req.query.twoStep == '1') opts.twoStep = true;
        if (req.query.serverMessageArray == '1') opts.includeServerMessages = true;
        server.getStatus(opts, (err, status) => {
          if (err) return returnError(err, res, req);
          res.json(status);
        });
      });
    });

    router.get('/v1/wallets/:identifier/', (req, res) => {
      getServerWithAuth(
        req,
        res,
        {
          onlySupportStaff: true
        },
        server => {
          const opts = {
            identifier: req.params['identifier'],
            walletCheck: req.params['walletCheck']
          };
          server.getWalletFromIdentifier(opts, (err, wallet) => {
            if (err) return returnError(err, res, req);
            if (!wallet) return res.end();

            server.walletId = wallet.id;
            const opts = { includeExtendedInfo: false };
            if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;
            server.getStatus(opts, (err, status) => {
              if (err) return returnError(err, res, req);
              res.json(status);
            });
          });
        }
      );
    });

    router.get('/v1/preferences/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.getPreferences({}, (err, preferences) => {
          if (err) return returnError(err, res, req);
          res.json(preferences);
        });
      });
    });

    router.put('/v1/preferences', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.savePreferences(req.body, (err, result) => {
          if (err) return returnError(err, res, req);
          res.json(result);
        });
      });
    });

    // DEPRECATED (do not use cashaddr)
    router.get('/v1/txproposals/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.getPendingTxs({ noCashAddr: true }, (err, pendings) => {
          if (err) return returnError(err, res, req);
          res.json(pendings);
        });
      });
    });

    router.get('/v2/txproposals/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.getPendingTxs({}, (err, pendings) => {
          if (err) return returnError(err, res, req);
          res.json(pendings);
        });
      });
    });

    // DEPRECATED
    router.post('/v1/txproposals/', (req, res) => {
      const Errors = require('./errors/errordefinitions');
      const err = Errors.UPGRADE_NEEDED;
      return returnError(err, res, req);
    });

    // DEPRECATED, no cash addr
    router.post('/v2/txproposals/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.noCashAddr = true;
        req.body.txpVersion = 3;
        server.createTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
        });
      });
    });

    router.post('/v3/txproposals/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txpVersion = 3;
        server.createTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
        });
      });
    });

    // create advertisement
    router.post('/v1/advertisements/', (req, res) => {
      getServerWithAuth(
        req,
        res,
        {
          onlyMarketingStaff: true
        },
        server => {
          server.createAdvert(req.body, (err, advert) => {
            if (err) {
              return returnError(err, res, req);
            }
            if (advert) res.json(advert);
          });
        }
      );
    });

    router.get('/v1/advertisements/', (req, res) => {
      let server;
      let testing = req.query.testing;

      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }

      if (testing) {
        server.getTestingAdverts(req.body, (err, ads) => {
          if (err) returnError(err, res, req);
          res.json(ads);
        });
      } else {
        SetPublicCache(res, 5 * ONE_MINUTE);
        server.getAdverts(req.body, (err, ads) => {
          if (err) returnError(err, res, req);
          res.json(ads);
        });
      }
    });

    router.get('/v1/advertisements/:adId/', (req, res) => {
      let server;

      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }

      let opts = { adId: req.params['adId'] };

      if (req.params['adId']) {
        server.getAdvert(opts, (err, ad) => {
          if (err) returnError(err, res, req);
          res.json(ad);
        });
      }
    });

    router.get('/v1/advertisements/country/:country', (req, res) => {
      let server;
      let country = req.params['country'];

      let opts = { country };

      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }

      server.getAdvertsByCountry(opts, (err, ads) => {
        if (err) returnError(err, res, req);
        res.json(ads);
      });
    });

    router.post('/v1/advertisements/:adId/activate', (req, res) => {
      let opts = { adId: req.params['adId'] };

      getServerWithAuth(
        req,
        res,
        {
          onlyMarketingStaff: true
        },
        server => {
          if (req.params['adId']) {
            server.activateAdvert(opts, (err, ad) => {
              if (err) returnError(err, res, req);
              res.json({ advertisementId: opts.adId, message: 'advert activated' });
            });
          }
        }
      );
    });

    router.post('/v1/advertisements/:adId/deactivate', (req, res) => {
      let opts = { adId: req.params['adId'] };

      getServerWithAuth(
        req,
        res,
        {
          onlyMarketingStaff: true
        },
        server => {
          if (req.params['adId']) {
            server.deactivateAdvert(opts, (err, ad) => {
              if (err) returnError(err, res, req);
              res.json({ advertisementId: opts.adId, message: 'advert deactivated' });
            });
          }
        }
      );
    });

    router.delete('/v1/advertisements/:adId/', (req, res) => {
      getServerWithAuth(
        req,
        res,
        {
          onlyMarketingStaff: true
        },
        server => {
          req.body.adId = req.params['adId'];
          server.removeAdvert(req.body, (err, removedAd) => {
            if (err) returnError(err, res, req);
            if (removedAd) {
              res.json(removedAd);
            }
          });
        }
      );
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

    // DEPRECATED
    router.post('/v1/addresses/', (req, res) => {
      logDeprecated(req);
      getServerWithAuth(req, res, server => {
        server.createAddress(
          {
            ignoreMaxGap: true
          },
          (err, address) => {
            if (err) return returnError(err, res, req);
            res.json(address);
          }
        );
      });
    });

    // DEPRECATED
    router.post('/v2/addresses/', (req, res) => {
      logDeprecated(req);
      getServerWithAuth(req, res, server => {
        server.createAddress(
          {
            ignoreMaxGap: true
          },
          (err, address) => {
            if (err) return returnError(err, res, req);
            res.json(address);
          }
        );
      });
    });

    // DEPRECATED (no cashaddr by default)
    router.post('/v3/addresses/', (req, res) => {
      getServerWithAuth(req, res, server => {
        let opts = req.body;
        opts = opts || {};
        opts.noCashAddr = true;
        server.createAddress(opts, (err, address) => {
          if (err) return returnError(err, res, req);
          res.json(address);
        });
      });
    });

    router.post('/v4/addresses/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.createAddress(req.body, (err, address) => {
          if (err) return returnError(err, res, req);
          res.json(address);
        });
      });
    });

    router.get('/v1/addresses/', (req, res) => {
      getServerWithAuth(req, res, server => {
        const opts: { limit?: number; reverse?: boolean } = {};
        if (req.query.limit) opts.limit = +req.query.limit;
        opts.reverse = req.query.reverse == '1';

        server.getMainAddresses(opts, (err, addresses) => {
          if (err) return returnError(err, res, req);
          res.json(addresses);
        });
      });
    });

    router.get('/v1/balance/', (req, res) => {
      getServerWithAuth(req, res, server => {
        const opts: { coin?: string; twoStep?: boolean; tokenAddress?: string; multisigContractAddress?: string } = {};
        if (req.query.coin) opts.coin = req.query.coin;
        if (req.query.twoStep == '1') opts.twoStep = true;
        if (req.query.tokenAddress) opts.tokenAddress = req.query.tokenAddress;
        if (req.query.multisigContractAddress) opts.multisigContractAddress = req.query.multisigContractAddress;

        server.getBalance(opts, (err, balance) => {
          if (err) return returnError(err, res, req);
          res.json(balance);
        });
      });
    });

    let estimateFeeLimiter;

    if (Defaults.RateLimit.estimateFee && !opts.ignoreRateLimiter) {
      logger.info(
        '',
        'Limiting estimate fee per IP: %d req/h',
        ((Defaults.RateLimit.estimateFee.max / Defaults.RateLimit.estimateFee.windowMs) * 60 * 60 * 1000).toFixed(2)
      );
      estimateFeeLimiter = new RateLimit(Defaults.RateLimit.estimateFee);
      // router.use(/\/v\d+\/wallets\/$/, createWalletLimiter)
    } else {
      estimateFeeLimiter = (req, res, next) => {
        next();
      };
    }

    // DEPRECATED
    router.get('/v1/feelevels/', estimateFeeLimiter, (req, res) => {
      SetPublicCache(res, 1 * ONE_MINUTE);
      logDeprecated(req);
      const opts: { network?: string } = {};
      if (req.query.network) opts.network = req.query.network;
      let server;
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server.getFeeLevels(opts, (err, feeLevels) => {
        if (err) return returnError(err, res, req);
        _.each(feeLevels, feeLevel => {
          feeLevel.feePerKB = feeLevel.feePerKb;
          delete feeLevel.feePerKb;
        });
        res.json(feeLevels);
      });
    });

    router.get('/v2/feelevels/', (req, res) => {
      const opts: { coin?: string; network?: string } = {};
      SetPublicCache(res, 1 * ONE_MINUTE);
      if (req.query.coin) opts.coin = req.query.coin;
      if (req.query.network) opts.network = req.query.network;

      let server;
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server.getFeeLevels(opts, (err, feeLevels) => {
        if (err) return returnError(err, res, req);
        res.json(feeLevels);
      });
    });

    router.post('/v3/estimateGas/', (req, res) => {
      getServerWithAuth(req, res, async server => {
        try {
          const gasLimit = await server.estimateGas(req.body);
          res.json(gasLimit);
        } catch (err) {
          returnError(err, res, req);
        }
      });
    });

    router.post('/v1/ethmultisig/', (req, res) => {
      getServerWithAuth(req, res, async server => {
        try {
          const multisigContractInstantiationInfo = await server.getMultisigContractInstantiationInfo(req.body);
          res.json(multisigContractInstantiationInfo);
        } catch (err) {
          returnError(err, res, req);
        }
      });
    });

    router.post('/v1/ethmultisig/info', (req, res) => {
      getServerWithAuth(req, res, async server => {
        try {
          const multisigContractInfo = await server.getMultisigContractInfo(req.body);
          res.json(multisigContractInfo);
        } catch (err) {
          returnError(err, res, req);
        }
      });
    });

    router.get('/v1/sendmaxinfo/', (req, res) => {
      getServerWithAuth(req, res, server => {
        const q = req.query;
        const opts: {
          feePerKb?: number;
          feeLevel?: number;
          returnInputs?: boolean;
          excludeUnconfirmedUtxos?: boolean;
        } = {};
        if (q.feePerKb) opts.feePerKb = +q.feePerKb;
        if (q.feeLevel) opts.feeLevel = q.feeLevel;
        if (q.excludeUnconfirmedUtxos == '1') opts.excludeUnconfirmedUtxos = true;
        if (q.returnInputs == '1') opts.returnInputs = true;
        server.getSendMaxInfo(opts, (err, info) => {
          if (err) return returnError(err, res, req);
          res.json(info);
        });
      });
    });

    router.get('/v1/utxos/', (req, res) => {
      const opts: { addresses?: string[] } = {};
      const addresses = req.query.addresses;
      if (addresses && _.isString(addresses)) opts.addresses = req.query.addresses.split(',');
      getServerWithAuth(req, res, server => {
        server.getUtxos(opts, (err, utxos) => {
          if (err) return returnError(err, res, req);
          res.json(utxos);
        });
      });
    });

    router.get('/v1/txcoins/', (req, res) => {
      const txId = req.query.txId;
      getServerWithAuth(req, res, server => {
        server.getCoinsForTx({ txId }, (err, coins) => {
          if (err) return returnError(err, res, req);
          res.json(coins);
        });
      });
    });

    router.post('/v1/broadcast_raw/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.broadcastRawTx(req.body, (err, txid) => {
          if (err) return returnError(err, res, req);
          res.json(txid);
          res.end();
        });
      });
    });

    // DEPRECATEED
    router.post('/v1/txproposals/:id/signatures/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.maxTxpVersion = 3;
        req.body.txProposalId = req.params['id'];
        server.signTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    // We created a new endpoint that support BCH schnorr signatues
    // so we can safely throw the error "UPGRADE NEEDED" if an old
    // client tries to post ECDSA signatures to a Schnorr TXP.
    // (using the old /v1/txproposal method): if (txp.signingMethod === 'schnorr' && !opts.supportBchSchnorr) return cb(Errors.UPGRADE_NEEDED);
    router.post('/v2/txproposals/:id/signatures/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txProposalId = req.params['id'];
        req.body.maxTxpVersion = 3;
        req.body.supportBchSchnorr = true;
        server.signTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    /* THIS WAS NEVED ENABLED YET NOW 2020-04-07 (see above)
    router.post('/v3/txproposals/:id/signatures/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txProposalId = req.params['id'];
        req.body.maxTxpVersion = 4;
        server.signTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });
    */

    //
    router.post('/v1/txproposals/:id/publish/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txProposalId = req.params['id'];
        req.body.noCashAddr = true;
        server.publishTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    router.post('/v2/txproposals/:id/publish/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txProposalId = req.params['id'];
        server.publishTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    // TODO Check HTTP verb and URL name
    router.post('/v1/txproposals/:id/broadcast/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txProposalId = req.params['id'];
        server.broadcastTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    router.post('/v1/txproposals/:id/rejections', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txProposalId = req.params['id'];
        server.rejectTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    router.delete('/v1/txproposals/:id/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txProposalId = req.params['id'];
        server.removePendingTx(req.body, err => {
          if (err) return returnError(err, res, req);
          res.json({
            success: true
          });
          res.end();
        });
      });
    });

    router.get('/v1/txproposals/:id/', (req, res) => {
      getServerWithAuth(req, res, server => {
        req.body.txProposalId = req.params['id'];
        server.getTx(req.body, (err, tx) => {
          if (err) return returnError(err, res, req);
          res.json(tx);
          res.end();
        });
      });
    });

    router.get('/v1/txhistory/', (req, res) => {
      getServerWithAuth(req, res, server => {
        const opts: {
          skip?: number;
          limit?: number;
          includeExtendedInfo?: boolean;
          tokenAddress?: string;
          multisigContractAddress?: string;
        } = {};
        if (req.query.skip) opts.skip = +req.query.skip;
        if (req.query.limit) opts.limit = +req.query.limit;
        if (req.query.tokenAddress) opts.tokenAddress = req.query.tokenAddress;
        if (req.query.multisigContractAddress) opts.multisigContractAddress = req.query.multisigContractAddress;
        if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;

        server.getTxHistory(opts, (err, txs) => {
          if (err) return returnError(err, res, req);
          res.json(txs);
          res.end();
        });
      });
    });

    router.post('/v1/addresses/scan/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.startScan(req.body, (err, started) => {
          if (err) return returnError(err, res, req);
          res.json(started);
          res.end();
        });
      });
    });

    // Retrive stats DO NOT UPDATE THEM
    // To update them run /updatestats
    router.get('/v1/stats/', (req, res) => {
      SetPublicCache(res, 1 * ONE_MINUTE);
      const opts: {
        network?: string;
        coin?: string;
        from?: string;
        to?: string;
      } = {};

      if (req.query.network) opts.network = req.query.network;
      if (req.query.coin) opts.coin = req.query.coin;
      if (req.query.from) opts.from = req.query.from;
      if (req.query.to) opts.to = req.query.to;

      const stats = new Stats(opts);
      stats.run((err, data) => {
        if (err) return returnError(err, res, req);
        res.json(data);
        res.end();
      });
    });

    router.get('/v1/version/', (req, res) => {
      SetPublicCache(res, 1 * ONE_MINUTE);
      res.json({
        serviceVersion: WalletService.getServiceVersion()
      });
      res.end();
    });

    router.post('/v1/login/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.login({}, (err, session) => {
          if (err) return returnError(err, res, req);
          res.json(session);
        });
      });
    });

    router.post('/v1/logout/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.logout({}, err => {
          if (err) return returnError(err, res, req);
          res.end();
        });
      });
    });

    router.get('/v1/notifications/', (req, res) => {
      getServerWithAuth(
        req,
        res,
        {
          allowSession: true
        },
        server => {
          const timeSpan = req.query.timeSpan
            ? Math.min(+req.query.timeSpan || 0, Defaults.MAX_NOTIFICATIONS_TIMESPAN)
            : Defaults.NOTIFICATIONS_TIMESPAN;
          const opts = {
            minTs: +Date.now() - timeSpan * 1000,
            notificationId: req.query.notificationId
          };

          server.getNotifications(opts, (err, notifications) => {
            if (err) return returnError(err, res, req);
            res.json(notifications);
          });
        }
      );
    });

    router.get('/v1/txnotes/:txid', (req, res) => {
      getServerWithAuth(req, res, server => {
        const opts = {
          txid: req.params['txid']
        };
        server.getTxNote(opts, (err, note) => {
          if (err) return returnError(err, res, req);
          res.json(note);
        });
      });
    });

    router.put('/v1/txnotes/:txid/', (req, res) => {
      req.body.txid = req.params['txid'];
      getServerWithAuth(req, res, server => {
        server.editTxNote(req.body, (err, note) => {
          if (err) return returnError(err, res, req);
          res.json(note);
        });
      });
    });

    router.get('/v1/txnotes/', (req, res) => {
      getServerWithAuth(req, res, server => {
        const opts: { minTs?: number } = {};
        if (req.query.minTs && _.isNumber(+req.query.minTs)) {
          opts.minTs = +req.query.minTs;
        }
        server.getTxNotes(opts, (err, notes) => {
          if (err) return returnError(err, res, req);
          res.json(notes);
        });
      });
    });

    router.get('/v1/fiatrates/:code/', (req, res) => {
      SetPublicCache(res, 5 * ONE_MINUTE);
      let server;
      const opts = {
        code: req.params['code'],
        coin: req.query.coin || 'btc',
        ts: req.query.ts ? +req.query.ts : null
      };
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server.getFiatRate(opts, (err, rates) => {
        if (err) return returnError(err, res, req);
        res.json(rates);
      });
    });

    router.get('/v2/fiatrates/:code/', (req, res) => {
      SetPublicCache(res, 5 * ONE_MINUTE);
      let server;
      const opts = {
        code: req.params['code'],
        ts: req.query.ts ? +req.query.ts : null
      };
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server.getHistoricalRates(opts, (err, rates) => {
        if (err) return returnError(err, res, req);
        res.json(rates);
      });
    });

    router.get('/v3/fiatrates/:coin/', (req, res) => {
      SetPublicCache(res, 5 * ONE_MINUTE);
      let server;
      const opts = {
        coin: req.params['coin'],
        code: req.query.code || null,
        ts: req.query.ts ? +req.query.ts : null
      };
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server.getFiatRates(opts, (err, rates) => {
        if (err) return returnError(err, res, req);
        res.json(rates);
      });
    });

    router.post('/v1/pushnotifications/subscriptions/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.pushNotificationsSubscribe(req.body, (err, response) => {
          if (err) return returnError(err, res, req);
          res.json(response);
        });
      });
    });

    // DEPRECATED
    router.delete('/v1/pushnotifications/subscriptions/', (req, res) => {
      logDeprecated(req);
      getServerWithAuth(req, res, server => {
        server.pushNotificationsUnsubscribe(
          {
            token: 'dummy'
          },
          (err, response) => {
            if (err) return returnError(err, res, req);
            res.json(response);
          }
        );
      });
    });

    router.delete('/v2/pushnotifications/subscriptions/:token', (req, res) => {
      const opts = {
        token: req.params['token']
      };
      getServerWithAuth(req, res, server => {
        server.pushNotificationsUnsubscribe(opts, (err, response) => {
          if (err) return returnError(err, res, req);
          res.json(response);
        });
      });
    });

    router.post('/v1/txconfirmations/', (req, res) => {
      getServerWithAuth(req, res, server => {
        server.txConfirmationSubscribe(req.body, (err, response) => {
          if (err) return returnError(err, res, req);
          res.json(response);
        });
      });
    });

    router.delete('/v1/txconfirmations/:txid', (req, res) => {
      const opts = {
        txid: req.params['txid']
      };
      getServerWithAuth(req, res, server => {
        server.txConfirmationUnsubscribe(opts, (err, response) => {
          if (err) return returnError(err, res, req);
          res.json(response);
        });
      });
    });

    router.post('/v1/service/simplex/quote', (req, res) => {
      getServerWithAuth(req, res, server => {
        server
          .simplexGetQuote(req)
          .then(response => {
            res.json(response);
          })
          .catch(err => {
            if (err) return returnError(err, res, req);
          });
      });
    });

    router.post('/v1/service/simplex/paymentRequest', (req, res) => {
      getServerWithAuth(req, res, server => {
        server
          .simplexPaymentRequest(req)
          .then(response => {
            res.json(response);
          })
          .catch(err => {
            if (err) return returnError(err, res, req);
          });
      });
    });

    router.get('/v1/service/simplex/events', (req, res) => {
      getServerWithAuth(req, res, server => {
        const opts = { env: req.query.env };
        server
          .simplexGetEvents(opts)
          .then(response => {
            res.json(response);
          })
          .catch(err => {
            if (err) return returnError(err, res, req);
          });
      });
    });

    router.post('/v1/service/wyre/walletOrderQuotation', (req, res) => {
      getServerWithAuth(req, res, server => {
        server
          .wyreWalletOrderQuotation(req)
          .then(response => {
            res.json(response);
          })
          .catch(err => {
            if (err) return returnError(err, res, req);
          });
      });
    });

    router.post('/v1/service/wyre/walletOrderReservation', (req, res) => {
      getServerWithAuth(req, res, server => {
        server
          .wyreWalletOrderReservation(req)
          .then(response => {
            res.json(response);
          })
          .catch(err => {
            if (err) return returnError(err, res, req);
          });
      });
    });

    router.get('/v1/service/payId/:payId', (req, res) => {
      let server;
      const payId = req.params['payId'];
      const opts = {
        handle: payId.split('$')[0],
        domain: payId.split('$')[1]
      };
      try {
        server = getServer(req, res);
      } catch (ex) {
        return returnError(ex, res, req);
      }
      server
        .discoverPayId(opts)
        .then(response => {
          res.json(response);
        })
        .catch(err => {
          if (err) return returnError(err, res, req);
        });
    });

    // Set no-cache by default
    this.app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    });

    this.app.use(opts.basePath || '/bws/api', router);

    if (config.staticRoot) {
      logger.debug(`Serving static files from ${config.staticRoot}`);
      this.app.use('/static', express.static(config.staticRoot));
    }

    WalletService.initialize(opts, cb);
  }
}
