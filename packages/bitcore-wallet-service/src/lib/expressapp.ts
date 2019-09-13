import express from 'express';
import _ from 'lodash';
import * as log from 'npmlog';
import { ClientError } from './errors/clienterror';
import { WalletService } from './server';
import { Stats } from './stats';

const bodyParser = require('body-parser');
const compression = require('compression');
const config = require('../config');
const RateLimit = require('express-rate-limit');
const Common = require('./common');
const Defaults = Common.Defaults;

log.disableColor();
log.debug = log.verbose;
log.level = 'verbose';

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
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS, PUT, DELETE'
      );
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
        log.warn('Request aborted by the client');
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
        res.status(503).send({code: errorCode, message: errorMessage});
      } else {
        next();
      }
    });

    if (opts.disableLogs) {
      log.level = 'silent';
    } else {
      const morgan = require('morgan');
      morgan.token('walletId', function getId(req) {
        return req.walletId ? '<' + req.walletId + '>' : '<>';
      });

      const logFormat =
        ':walletId :remote-addr :date[iso] ":method :url" :status :res[content-length] :response-time ":user-agent"  ';
      const logOpts = {
        skip(req, res) {
          if (res.statusCode != 200) return false;
          return req.path.indexOf('/notifications/') >= 0;
        }
      };
      this.app.use(morgan(logFormat, logOpts));
    }

    const router = express.Router();

    const returnError = (err, res, req) => {
      if (err instanceof ClientError) {
        const status = err.code == 'NOT_AUTHORIZED' ? 401 : 400;
        if (!opts.disableLogs)
          log.info(
            'Client Err: ' + status + ' ' + req.url + ' ' + JSON.stringify(err)
          );

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

        if (!opts.disableLogs) log.error(req.url + ' :' + code + ':' + m);

        res
          .status(code || 500)
          .json({
            error: m
          })
          .end();
      }
    };

    const logDeprecated = (req) => {
      log.warn(
        'DEPRECATED',
        req.method,
        req.url,
        '(' + req.header('x-client-version') + ')'
      );
    };

    const getCredentials = (req) => {
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

    const getServerWithAuth = (
      req,
      res,
      opts,
      cb?: (err: any, data?: any) => void
    ) => {
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
        message:
          req.method.toLowerCase() +
          '|' +
          req.url +
          '|' +
          JSON.stringify(req.body),
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

        // For logging
        req.walletId = server.walletId;
        req.copayerId = server.copayerId;

        return cb(server);
      });
    };

    let createWalletLimiter;

    if (Defaults.RateLimit.createWallet && !opts.ignoreRateLimiter) {
      log.info(
        '',
        'Limiting wallet creation per IP: %d req/h',
        (
          (Defaults.RateLimit.createWallet.max /
            Defaults.RateLimit.createWallet.windowMs) *
          60 *
          60 *
          1000
        ).toFixed(2)
      );
      createWalletLimiter = new RateLimit(Defaults.RateLimit.createWallet);
      // router.use(/\/v\d+\/wallets\/$/, createWalletLimiter)
    } else {
      createWalletLimiter = (req, res, next) => {
        next();
      };
    }

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
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
        const opts = { includeExtendedInfo: false, twoStep: false };
        if (req.query.includeExtendedInfo == '1')
          opts.includeExtendedInfo = true;
        if (req.query.twoStep == '1') opts.twoStep = true;

        server.getStatus(opts, (err, status) => {
          if (err) return returnError(err, res, req);
          res.json(status);
        });
      });
    });

    router.get('/v3/wallets/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        const opts = { includeExtendedInfo: false, twoStep: false, includeServerMessages: false };
        if (req.query.includeExtendedInfo == '1')
          opts.includeExtendedInfo = true;
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
        (server) => {
          const opts = {
            identifier: req.params['identifier'],
            walletCheck: req.params['walletCheck']
          };
          server.getWalletFromIdentifier(opts, (err, wallet) => {
            if (err) return returnError(err, res, req);
            if (!wallet) return res.end();

            server.walletId = wallet.id;
            const opts = { includeExtendedInfo: false };
            if (req.query.includeExtendedInfo == '1')
              opts.includeExtendedInfo = true;
            server.getStatus(opts, (err, status) => {
              if (err) return returnError(err, res, req);
              res.json(status);
            });
          });
        }
      );
    });

    router.get('/v1/preferences/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.getPreferences({}, (err, preferences) => {
          if (err) return returnError(err, res, req);
          res.json(preferences);
        });
      });
    });

    router.put('/v1/preferences', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.savePreferences(req.body, (err, result) => {
          if (err) return returnError(err, res, req);
          res.json(result);
        });
      });
    });

    // DEPRECATED (do not use cashaddr)
    router.get('/v1/txproposals/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.getPendingTxs({ noCashAddr: true }, (err, pendings) => {
          if (err) return returnError(err, res, req);
          res.json(pendings);
        });
      });
    });

    router.get('/v2/txproposals/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.getPendingTxs({}, (err, pendings) => {
          if (err) return returnError(err, res, req);
          res.json(pendings);
        });
      });
    });

    router.post('/v1/txproposals/', (req, res) => {
      const Errors = require('./errors/errordefinitions');
      const err = Errors.UPGRADE_NEEDED;
      return returnError(err, res, req);
    });

    // DEPRECATED, no cash addr
    router.post('/v2/txproposals/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        req.body.noCashAddr = true;
        server.createTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
        });
      });
    });

    router.post('/v3/txproposals/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.createTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
        });
      });
    });

    // DEPRECATED
    router.post('/v1/addresses/', (req, res) => {
      logDeprecated(req);
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
        server.createAddress(req.body, (err, address) => {
          if (err) return returnError(err, res, req);
          res.json(address);
        });
      });
    });

    router.get('/v1/addresses/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
        const opts: { coin?: string; twoStep?: boolean } = {};
        if (req.query.coin) opts.coin = req.query.coin;
        if (req.query.twoStep == '1') opts.twoStep = true;
        server.getBalance(opts, (err, balance) => {
          if (err) return returnError(err, res, req);
          res.json(balance);
        });
      });
    });

    let estimateFeeLimiter;

    if (Defaults.RateLimit.estimateFee && !opts.ignoreRateLimiter) {
      log.info(
        '',
        'Limiting estimate fee per IP: %d req/h',
        (
          (Defaults.RateLimit.estimateFee.max /
            Defaults.RateLimit.estimateFee.windowMs) *
          60 *
          60 *
          1000
        ).toFixed(2)
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
        _.each(feeLevels, (feeLevel) => {
          feeLevel.feePerKB = feeLevel.feePerKb;
          delete feeLevel.feePerKb;
        });
        res.json(feeLevels);
      });
    });

    router.get('/v2/feelevels/', (req, res) => {
      const opts: { coin?: string; network?: string } = {};
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
      getServerWithAuth(req, res, (server) => {
        server.estimateGas(req.body, (err, gasLimit) => {
          if (err) return returnError(err, res, req);
          res.json(gasLimit);
        });
      });
    });

    router.get('/v1/sendmaxinfo/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        const q = req.query;
        const opts: {
          feePerKb?: number;
          feeLevel?: number;
          returnInputs?: boolean;
          excludeUnconfirmedUtxos?: boolean;
        } = {};
        if (q.feePerKb) opts.feePerKb = +q.feePerKb;
        if (q.feeLevel) opts.feeLevel = q.feeLevel;
        if (q.excludeUnconfirmedUtxos == '1')
          opts.excludeUnconfirmedUtxos = true;
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
      if (addresses && _.isString(addresses))
        opts.addresses = req.query.addresses.split(',');
      getServerWithAuth(req, res, (server) => {
        server.getUtxos(opts, (err, utxos) => {
          if (err) return returnError(err, res, req);
          res.json(utxos);
        });
      });
    });

    router.post('/v1/broadcast_raw/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.broadcastRawTx(req.body, (err, txid) => {
          if (err) return returnError(err, res, req);
          res.json(txid);
          res.end();
        });
      });
    });

    router.post('/v1/txproposals/:id/signatures/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        req.body.txProposalId = req.params['id'];
        server.signTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    //
    router.post('/v1/txproposals/:id/publish/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
        req.body.txProposalId = req.params['id'];
        server.broadcastTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    router.post('/v1/txproposals/:id/rejections', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        req.body.txProposalId = req.params['id'];
        server.rejectTx(req.body, (err, txp) => {
          if (err) return returnError(err, res, req);
          res.json(txp);
          res.end();
        });
      });
    });

    router.delete('/v1/txproposals/:id/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        req.body.txProposalId = req.params['id'];
        server.removePendingTx(req.body, (err) => {
          if (err) return returnError(err, res, req);
          res.json({
            success: true
          });
          res.end();
        });
      });
    });

    router.get('/v1/txproposals/:id/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        req.body.txProposalId = req.params['id'];
        server.getTx(req.body, (err, tx) => {
          if (err) return returnError(err, res, req);
          res.json(tx);
          res.end();
        });
      });
    });

    router.get('/v1/txhistory/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        const opts: {
          skip?: number;
          limit?: number;
          includeExtendedInfo?: boolean;
        } = {};
        if (req.query.skip) opts.skip = +req.query.skip;
        if (req.query.limit) opts.limit = +req.query.limit;
        if (req.query.includeExtendedInfo == '1')
          opts.includeExtendedInfo = true;

        server.getTxHistory(opts, (err, txs) => {
          if (err) return returnError(err, res, req);
          res.json(txs);
          res.end();
        });
      });
    });

    router.post('/v1/addresses/scan/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.startScan(req.body, (err, started) => {
          if (err) return returnError(err, res, req);
          res.json(started);
          res.end();
        });
      });
    });

    router.get('/v1/stats/', (req, res) => {
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
      res.json({
        serviceVersion: WalletService.getServiceVersion()
      });
      res.end();
    });

    router.post('/v1/login/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.login({}, (err, session) => {
          if (err) return returnError(err, res, req);
          res.json(session);
        });
      });
    });

    router.post('/v1/logout/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.logout({}, (err) => {
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
        (server) => {
          const timeSpan = req.query.timeSpan
            ? Math.min(
              +req.query.timeSpan || 0,
              Defaults.MAX_NOTIFICATIONS_TIMESPAN
            )
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
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
        server.editTxNote(req.body, (err, note) => {
          if (err) return returnError(err, res, req);
          res.json(note);
        });
      });
    });

    router.get('/v1/txnotes/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
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
      let server;
      const opts = {
        code: req.params['code'],
        coin: req.query.coin || 'btc',
        ts: (req.query.ts ? +req.query.ts : null),
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

    router.post('/v1/pushnotifications/subscriptions/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
        server.pushNotificationsSubscribe(req.body, (err, response) => {
          if (err) return returnError(err, res, req);
          res.json(response);
        });
      });
    });

    // DEPRECATED
    router.delete('/v1/pushnotifications/subscriptions/', (req, res) => {
      logDeprecated(req);
      getServerWithAuth(req, res, (server) => {
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

    router.delete('/v2/pushnotifications/subscriptions/:token', (
      req,
      res
    ) => {
      const opts = {
        token: req.params['token']
      };
      getServerWithAuth(req, res, (server) => {
        server.pushNotificationsUnsubscribe(opts, (err, response) => {
          if (err) return returnError(err, res, req);
          res.json(response);
        });
      });
    });

    router.post('/v1/txconfirmations/', (req, res) => {
      getServerWithAuth(req, res, (server) => {
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
      getServerWithAuth(req, res, (server) => {
        server.txConfirmationUnsubscribe(opts, (err, response) => {
          if (err) return returnError(err, res, req);
          res.json(response);
        });
      });
    });

    this.app.use(opts.basePath || '/bws/api', router);

    WalletService.initialize(opts, cb);
  }
}
